"""Back end of the site editor (_dev/flores.html), used by _dev/serve.py.

The editor works on one branch at a time. Each branch is edited in its own worktree (created on
demand under .claude/worktrees/ed-<branch>), and "Guardar" writes the changed files there and
commits them on that branch (and pushes it, if asked). Nothing here touches other branches.

What the editor can change, and where it lands:
  flowers   js/flores-layout.js                       (generated)
  texts     index.html (Spanish, inside data-i18n elements) and js/i18n.js (English map)
  look      css/editor.css: palette tokens, fonts, photo framing, section order and visibility,
            moved and styled texts (generated)
  photos    assets/hero-desktop.jpg, assets/hero-mobile.jpg, assets/foto-envio.jpg
"""
import base64
import datetime
import html
import html.parser
import json
import os
import re
import subprocess

REPO_FILES = ('index.html', 'playlist-admin.html')
PHOTOS = {'hero-desktop': 'assets/hero-desktop.jpg', 'hero-mobile': 'assets/hero-mobile.jpg', 'foto-envio': 'assets/foto-envio.jpg'}
TOKENS = ('paper', 'paper-deep', 'paper-line', 'olive', 'olive-deep', 'olive-soft', 'olive-wash', 'terracotta',
          'terracotta-deep', 'ink', 'ink-soft', 'ink-faint', 'cream-text', 'gold')
SECTIONS = ('intro', 'countdown', 'locations', 'timeline', 'rsvp', 'gifts', 'playlist', 'social', 'footer')
COLOR = re.compile(r'^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\))$')
BRANCH = re.compile(r'^[A-Za-z0-9._-]{1,60}(/[A-Za-z0-9._-]{1,60})?$')

# The fonts the Fuentes tab offers: free Google Fonts, one list per role (the CSS token it sets).
# The first of each list is the site's own (styles.css). This list is the source of truth: the
# editor renders it from /_dev/api/state and write_look accepts nothing else. Script faces differ a
# lot in size, so each carries a scale that headings (.h-script) multiply their size by.
# Serif axes: what styles.css uses (400-600 and italics); Libre Caslon Text and Cardo only come in
# 400, 700 and italic 400, so they ask for those (600 then takes the bold).
_SERIF_AXES, _SERIF_AXES_3 = 'ital,wght@0,400;0,500;0,600;1,400;1,500', 'ital,wght@0,400;0,700;1,400'
FONTS = {
    'serif': [{'name': n, 'axes': _SERIF_AXES_3 if n in ('Libre Caslon Text', 'Cardo') else _SERIF_AXES} for n in (
        'Cormorant Garamond', 'EB Garamond', 'Playfair Display', 'Libre Caslon Text', 'Lora', 'Crimson Pro',
        'Spectral', 'Cardo')],
    'script': [{'name': n, 'scale': s} for n, s in (
        # scale: about the same width as Allison for the same heading (measured, then eyeballed)
        ('Allison', 1), ('Great Vibes', 0.75), ('Parisienne', 0.65), ('Pinyon Script', 0.7), ('Alex Brush', 0.75),
        ('Sacramento', 0.75), ('Mrs Saint Delafield', 0.9), ('Dancing Script', 0.7))],
    'hand': [{'name': n} for n in (
        'Homemade Apple', 'Caveat', 'Indie Flower', 'Shadows Into Light', 'Nothing You Could Do', 'Reenie Beanie',
        'Kalam', 'Patrick Hand')],
}
FONT_FALLBACK = {'serif': "'Times New Roman', serif", 'script': 'cursive', 'hand': 'cursive'}


def font_spec(role, name):
    """The curated entry for a family, or None."""
    return next((f for f in FONTS.get(role, ()) if f['name'] == name), None)


def fonts_url(fonts):
    """Google Fonts stylesheet for {role: family}: one request for all of them."""
    fam = []
    for role, name in fonts.items():
        f = font_spec(role, name)
        if f:
            fam.append('family=' + f['name'].replace(' ', '+') + (':' + f['axes'] if f.get('axes') else ''))
    return 'https://fonts.googleapis.com/css2?%s&display=swap' % '&'.join(fam) if fam else ''


class EditorError(Exception):
    pass


def run(cwd, *args):
    r = subprocess.run(['git', '-C', cwd, *args], capture_output=True, text=True)
    if r.returncode:
        raise EditorError((r.stderr or r.stdout).strip()[:300])
    return r.stdout


# ---------- branches and worktrees ----------

def worktree_map(repo):
    """branch -> worktree path, from `git worktree list --porcelain`."""
    out, path = {}, None
    for line in run(repo, 'worktree', 'list', '--porcelain').splitlines():
        if line.startswith('worktree '):
            path = line[9:]
        elif line.startswith('branch refs/heads/'):
            out[line[18:]] = path
    return out


def branches(repo):
    local = run(repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split()
    remote = [b.split('/', 1)[1] for b in run(repo, 'for-each-ref', '--format=%(refname:short)', 'refs/remotes').split()
              if '/' in b and not b.endswith('/HEAD')]
    wts = worktree_map(repo)
    names = sorted(set(local) | set(remote), key=lambda b: (b != 'main', b))
    return [{'branch': b, 'local': b in local, 'remote': b in remote, 'checked_out': b in wts} for b in names]


def open_branch(repo, branch):
    """Worktree folder for a branch, creating it if no worktree has the branch checked out."""
    if not BRANCH.match(branch):
        raise EditorError('Nombre de rama no válido')
    wts = worktree_map(repo)
    if branch not in wts:
        path = os.path.join(repo_root(repo), '.claude', 'worktrees', 'ed-' + branch.replace('/', '-'))
        local = run(repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split()
        if branch in local:
            run(repo, 'worktree', 'add', path, branch)
        else:
            run(repo, 'worktree', 'add', '--track', '-b', branch, path, 'origin/' + branch)
        wts = worktree_map(repo)
    return wts[branch]


def new_branch(repo, name, base):
    if not BRANCH.match(name) or not BRANCH.match(base):
        raise EditorError('Nombre de rama no válido')
    if any(b['branch'] == name for b in branches(repo)):
        raise EditorError('Esa rama ya existe')
    src = base if base in run(repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads').split() else 'origin/' + base
    run(repo, 'branch', '--no-track', name, src)
    return open_branch(repo, name)


def repo_root(repo):
    """The main checkout (worktrees live under it)."""
    common = run(repo, 'rev-parse', '--path-format=absolute', '--git-common-dir').strip()
    return os.path.dirname(common)


# ---------- texts: data-i18n elements in index.html, English map in js/i18n.js ----------

def _elements(src):
    """(key, tag, inner_start, inner_end) for every data-i18n element, matching nested tags of the same name."""
    out = []
    for m in re.finditer(r'<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)\sdata-i18n="([^"]+)"([^>]*)>', src):
        tag, key, start = m.group(1).lower(), m.group(3), m.end()
        depth, pos = 1, start
        pat = re.compile(r'<(/?)%s\b[^>]*?(/?)>' % tag, re.I)
        while depth:
            n = pat.search(src, pos)
            if not n:
                break
            if n.group(1):
                depth -= 1
            elif not n.group(2):
                depth += 1
            pos = n.end()
            if not depth:
                out.append((key, tag, start, n.start()))
    return out


def _en_block(js):
    a = js.index('const EN = {')
    b = js.index('\n  };', a)
    return a, b


JS_STR = r"""('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")"""


def _js_value(lit):
    if lit[0] == '"':
        return json.loads(lit)
    body = lit[1:-1].replace('\\\'', "'").replace('"', '\\"')
    return json.loads('"' + body + '"')


def _js_literal(text):
    s = json.dumps(text, ensure_ascii=False)          # "…" with \" and \\ escaped
    if "'" not in text:
        s = "'" + s[1:-1].replace('\\"', '"') + "'"
    return s


def read_texts(wt):
    src = open(os.path.join(wt, 'index.html'), encoding='utf-8').read()
    js = open(os.path.join(wt, 'js', 'i18n.js'), encoding='utf-8').read()
    a, b = _en_block(js)
    en = {m.group(1): _js_value(m.group(2)) for m in re.finditer(r"'([\w.-]+)':\s*" + JS_STR, js[a:b])}
    out = {}
    for key, tag, s, e in _elements(src):
        if key not in out:
            out[key] = {'es': src[s:e].strip(), 'en': en.get(key, ''), 'tag': tag}
    return out


class _Clean(html.parser.HTMLParser):
    """Keeps text plus a few inline tags; drops everything else (scripts, handlers, styles)."""
    ALLOWED = {'br': (), 'span': ('class',), 'a': ('href', 'target', 'rel'), 'strong': (), 'em': (), 'b': (), 'i': ()}

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.out, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
            return
        if tag not in self.ALLOWED:
            return
        keep = []
        for k, v in attrs:
            if k in self.ALLOWED[tag] and v is not None:
                if k == 'href' and not re.match(r'^(#|https?://|mailto:|tel:)', v):
                    continue
                keep.append(' %s="%s"' % (k, html.escape(v, quote=True)))
        self.out.append('<%s%s>' % (tag, ''.join(keep)))

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)
        elif tag in self.ALLOWED and tag != 'br':
            self.out.append('</%s>' % tag)

    def handle_data(self, d):
        if not self.skip:
            self.out.append(d.replace('<', '&lt;').replace('>', '&gt;'))

    def handle_entityref(self, name):
        self.out.append('&%s;' % name)

    def handle_charref(self, name):
        self.out.append('&#%s;' % name)


def clean_html(text):
    p = _Clean()
    p.feed(str(text)[:4000])
    p.close()
    return ''.join(p.out).strip()


def write_texts(wt, changes):
    """changes: {key: {es, en}}. Spanish goes into every element with that data-i18n key."""
    path = os.path.join(wt, 'index.html')
    src = open(path, encoding='utf-8').read()
    js_path = os.path.join(wt, 'js', 'i18n.js')
    js = open(js_path, encoding='utf-8').read()
    known = {k for k, *_ in _elements(src)}
    done = []
    for key, val in changes.items():
        if key not in known or not re.match(r'^[\w.-]+$', key):
            continue
        if 'es' in val:
            es = clean_html(val['es'])
            for k, tag, s, e in sorted(_elements(src), key=lambda x: -x[2]):   # from the end, offsets stay valid
                if k == key:
                    src = src[:s] + es + src[e:]
        if 'en' in val:
            en = clean_html(val['en'])
            a, b = _en_block(js)
            block = js[a:b]
            pat = re.compile(r"('%s':\s*)%s" % (re.escape(key), JS_STR))
            if pat.search(block):
                block = pat.sub(lambda m: m.group(1) + _js_literal(en), block, count=1)
            else:
                block += "\n    '%s': %s," % (key, _js_literal(en))
            js = js[:a] + block + js[b:]
        done.append(key)
    open(path, 'w', encoding='utf-8').write(src)
    open(js_path, 'w', encoding='utf-8').write(js)
    return ['index.html', 'js/i18n.js'] if done else []


# ---------- look: css/editor.css ----------

def read_look(wt):
    try:
        css = open(os.path.join(wt, 'css', 'editor.css'), encoding='utf-8').read()
    except FileNotFoundError:
        return {}
    m = re.search(r'/\* editor-state (\{.*?\}) \*/', css, re.S)
    return json.loads(m.group(1)) if m else {}


def _pct(v, default):
    try:
        return max(0, min(100, round(float(v), 1)))
    except (TypeError, ValueError):
        return default


TEXT_Z = {'back': -2, 'front': 3}   # against .flor (z -1) and .flor--front (z 2) in styles.css
TEXT_KEY = re.compile(r'^(#[\w-]+|[\w.-]+)$')


TEXT_ALIGN = ('left', 'center', 'right')
TEXT_FONT = ('serif', 'script', 'hand')
STYLE_KEYS = ('size', 'color', 'align', 'font')
HEX6 = re.compile(r'^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')


def _tplace(v):
    """One text placement {x, y, z} in px, plus its style if any (size px, color hex, align, font
    role); None if it is not one."""
    if not isinstance(v, dict):
        return None
    try:
        x, y = (max(-2000, min(2000, int(round(float(v.get(k) or 0))))) for k in ('x', 'y'))
    except (TypeError, ValueError):
        return None
    p = {'x': x, 'y': y, 'z': v.get('z') if v.get('z') in TEXT_Z else ''}
    try:
        if v.get('size') is not None:
            p['size'] = max(8, min(200, int(round(float(v['size'])))))
    except (TypeError, ValueError):
        pass
    c = str(v.get('color') or '').strip()
    if HEX6.match(c):
        c = c.lower()
        p['color'] = c if len(c) == 7 else '#' + ''.join(ch * 2 for ch in c[1:])
    if v.get('align') in TEXT_ALIGN:
        p['align'] = v['align']
    if v.get('font') in TEXT_FONT:
        p['font'] = v['font']
    return p


def _styled(p):
    return any(k in p for k in STYLE_KEYS)


def _tsel(k):
    return 'main %s' % k if k.startswith('#') else 'main [data-i18n="%s"]' % k


def _tkey(k):
    return k if k.startswith('#') else '[data-i18n="%s"]' % k


# A text's own style goes in rules of its own, under #main-content: an id beats the class rules of
# styles.css (.h-script.light sets the colour, .text-center > .h-script the margins).
H_ALIGN = {'left': ('0', 'auto'), 'center': ('auto', 'auto'), 'right': ('auto', '0')}


def _tstyle(p):
    """The style declarations of one placement (size, colour, alignment, font)."""
    d = []
    if 'size' in p:
        d.append('font-size: %dpx' % p['size'])
    if 'color' in p:
        d.append('color: %s' % p['color'])
    if 'align' in p:
        d.append('text-align: %s' % p['align'])
    if 'font' in p:
        d.append('font-family: var(--font-%s)' % p['font'])
    return d


def _trules(k, p):
    """[(selector, [declarations])] for the style of one placement. A script heading (.h-script)
    is an inline-block as wide as its text: to align it, it becomes a block of that width placed by
    its margins (the extra rule only matches if the text is one)."""
    st = _tstyle(p)
    rules = [('#main-content %s' % _tkey(k), st)] if st else []
    if 'align' in p:
        ml, mr = H_ALIGN[p['align']]
        rules.append(('#main-content .h-script%s' % _tkey(k),
                      ['display: block', 'width: fit-content', 'margin-left: %s' % ml, 'margin-right: %s' % mr]))
    return rules


def _tdecl(p, reset):
    """The move/layer declarations for one placement; reset=True (the wide-screen rule) undoes the phone one."""
    d = []
    if p['x'] or p['y']:
        d.append('transform: translate(%dpx, %dpx)' % (p['x'], p['y']))
    elif reset:
        d.append('transform: none')
    if p['z']:
        d += ['position: relative', 'z-index: %d' % TEXT_Z[p['z']]]
    elif reset:
        d.append('z-index: auto')
    return d


def write_look(wt, look):
    """look: {tokens: {name: color}, frame: {slot: [x, y]}, order: [ids], hidden: [ids],
    text: {key: {x, y, z, size?, color?, align?, font?, d?: {same}}}, palettes: [{name, tokens}],
    fonts: {serif?, script?, hand?: family from FONTS}}."""
    tokens = {k: v.strip() for k, v in (look.get('tokens') or {}).items() if k in TOKENS and COLOR.match(str(v).strip())}
    frame = {k: [_pct(v[0], 50), _pct(v[1], 50)] for k, v in (look.get('frame') or {}).items() if k in PHOTOS and isinstance(v, list) and len(v) == 2}
    order = [s for s in (look.get('order') or []) if s in SECTIONS]
    if order:   # a partial order would leave the rest at order 0, before it: complete it in page order
        order += [s for s in SECTIONS if s not in order]
    hidden = [s for s in (look.get('hidden') or []) if s in SECTIONS]
    text = {}   # moved texts: the data-i18n key (or #id) of a heading or paragraph
    for k, v in (look.get('text') or {}).items():
        p = _tplace(v) if TEXT_KEY.match(str(k)) else None
        if not p:
            continue
        d = _tplace(v.get('d'))
        if d:
            p['d'] = d
        if p['x'] or p['y'] or p['z'] or _styled(p) or d:
            text[k] = p
    palettes = []   # the couple's own palettes, so every computer that opens the branch sees them
    for pal in (look.get('palettes') or [])[:20]:
        if not isinstance(pal, dict):
            continue
        toks = {k: str(v).strip() for k, v in (pal.get('tokens') or {}).items() if k in TOKENS and COLOR.match(str(v).strip())}
        name = re.sub(r'[^\w áéíóúñÁÉÍÓÚÑüÜ,.()/+-]', '', str(pal.get('name') or '')).strip()[:40]
        if toks and name:
            palettes.append({'name': name, 'tokens': toks})
    fonts = {}   # role -> family, from the curated list only
    raw = look.get('fonts') if isinstance(look.get('fonts'), dict) else {}
    for role, name in raw.items():
        if role in FONTS and font_spec(role, name):
            fonts[role] = name
    state = {'tokens': tokens, 'frame': frame, 'order': order, 'hidden': hidden, 'text': text, 'palettes': palettes, 'fonts': fonts}
    sel = lambda s: '.footer-section' if s == 'footer' else '#' + s
    css = ['/* Written by the site editor (_dev/flores.html): edit it there, not by hand.',
           '   Loaded after styles.css. Delete this file to go back to styles.css alone. */',
           '/* editor-state %s */' % json.dumps(state, ensure_ascii=False)]
    if fonts:   # @import must come before every rule (comments may precede it)
        css.append('@import url("%s");' % fonts_url(fonts))
        decl = ['  --font-%s: \'%s\', %s;' % (r, n, FONT_FALLBACK[r]) for r, n in fonts.items()]
        if 'script' in fonts:
            decl.append('  --font-script-scale: %s;' % font_spec('script', fonts['script'])['scale'])
        css.append(':root {\n%s\n}' % '\n'.join(decl))
    if tokens:
        css.append(':root {\n%s\n}' % '\n'.join('  --%s: %s;' % (k, v) for k, v in tokens.items()))
    if 'hero-desktop' in frame:
        x, y = frame['hero-desktop']
        css.append('@media (min-width: 769px) and (orientation: landscape) {\n  .hero-photo img { object-position: %s%% %s%%; }\n  .card-back { background-position: %s%% %s%%; }\n}' % (x, y, x, y))
    if 'hero-mobile' in frame:
        x, y = frame['hero-mobile']
        css.append('@media (max-width: 768px), (orientation: portrait) {\n  .hero-photo img { object-position: %s%% %s%%; }\n  .card-back { background-position: %s%% %s%%; }\n}' % (x, y, x, y))
    if 'foto-envio' in frame:
        x, y = frame['foto-envio']
        css.append('.rsvp-modal-photo img { object-position: %s%% %s%%; }' % (x, y))
    if order:
        css.append('#main-content { display: flex; flex-direction: column; }\n#hero { order: -1; }')
        css.extend('%s { order: %d; }' % (sel(s), i + 1) for i, s in enumerate(order))
    if hidden:
        css.append('%s { display: none !important; }' % ', '.join(sel(s) for s in hidden))
    rule = lambda r: '%s { %s; }' % (r[0], '; '.join(r[1]))
    for k, p in text.items():
        # moves and layers: a phone rule, undone or replaced by the wide-screen one
        base = _tdecl(p, False)
        if base:
            css.append('%s { %s; }' % (_tsel(k), '; '.join(base)))
        if p.get('d'):
            css.append('@media (min-width: 769px) {\n  %s { %s; }\n}' % (_tsel(k), '; '.join(_tdecl(p['d'], True))))
        # styles: one set for every width, or (if the text has its own wide-screen variant) one per
        # width in its own media query, since a later rule cannot hand a property back to styles.css
        if not p.get('d'):
            css.extend(rule(r) for r in _trules(k, p))
        else:
            for mq, q in (('(max-width: 768px)', p), ('(min-width: 769px)', p['d'])):
                rs = _trules(k, q)
                if rs:
                    css.append('@media %s {\n%s\n}' % (mq, '\n'.join('  ' + rule(r) for r in rs)))
    os.makedirs(os.path.join(wt, 'css'), exist_ok=True)
    open(os.path.join(wt, 'css', 'editor.css'), 'w', encoding='utf-8').write('\n'.join(css) + '\n')
    # make sure the page loads it, right after styles.css
    path = os.path.join(wt, 'index.html')
    src = open(path, encoding='utf-8').read()
    if 'css/editor.css' not in src:
        src = re.sub(r'(<link rel="stylesheet" href="css/styles\.css(\?v=[\w-]+)?">)',
                     lambda m: m.group(1) + '\n  <link rel="stylesheet" href="css/editor.css?v=0">', src, count=1)
        open(path, 'w', encoding='utf-8').write(src)
    return ['css/editor.css', 'index.html']


# ---------- photos ----------

def write_photo(wt, slot, data_url):
    if slot not in PHOTOS:
        raise EditorError('Foto desconocida')
    m = re.match(r'^data:image/jpeg;base64,([A-Za-z0-9+/=]+)$', data_url or '')
    if not m:
        raise EditorError('La foto tiene que llegar como JPEG')
    data = base64.b64decode(m.group(1))
    if len(data) > 4_000_000 or data[:3] != b'\xff\xd8\xff':
        raise EditorError('Foto no válida o demasiado grande')
    open(os.path.join(wt, PHOTOS[slot]), 'wb').write(data)
    return [PHOTOS[slot]]


# ---------- save: write, bump cache-busters, commit, push ----------

def bump(wt, photos):
    """New ?v= on css/js links (and on the changed photos), so visitors never mix old and new files."""
    stamp = datetime.datetime.now().strftime('%Y%m%d%H%M')
    changed = []
    for name in REPO_FILES + ('css/styles.css', 'css/editor.css'):
        path = os.path.join(wt, name)
        if not os.path.exists(path):
            continue
        s = t = open(path, encoding='utf-8').read()
        if name.endswith('.html'):
            t = re.sub(r'((?:css|js)/[\w./-]+\.(?:css|js))\?v=[\w-]+', r'\1?v=' + stamp, t)
        for p in photos:
            t = re.sub(r'(?<=["\'(/])(%s)(\?v=[\w-]+)?' % re.escape(p), r'\1?v=' + stamp, t)   # real references only, not comments
        if t != s:
            open(path, 'w', encoding='utf-8').write(t)
            changed.append(name)
    return changed


def save(repo, branch, payload, write_flores):
    wt = open_branch(repo, branch)
    files, parts, photos = [], [], []
    if 'flores' in payload:
        files.append(write_flores(wt, payload['flores'])); parts.append('flores')
    if payload.get('texts'):
        f = write_texts(wt, payload['texts'])
        if f:
            files += f; parts.append('textos (%d)' % len(payload['texts']))
    if 'look' in payload:
        files += write_look(wt, payload['look']); parts.append('colores/encuadre/secciones')
    for slot, data_url in (payload.get('photos') or {}).items():
        photos += write_photo(wt, slot, data_url); parts.append('foto ' + slot)
    files += photos
    if files:
        files += bump(wt, photos)
    files = sorted(set(files))
    if not files:
        return {'ok': True, 'commit': None, 'files': []}
    run(wt, 'add', '--', *files)
    if not run(wt, 'diff', '--cached', '--name-only').strip():
        return {'ok': True, 'commit': None, 'files': []}
    who = re.sub(r'[^\w áéíóúñÁÉÍÓÚÑ.-]', '', str(payload.get('who') or ''))[:40] or 'editor'
    note = re.sub(r'[\r\n]+', ' ', str(payload.get('message') or ''))[:200]
    msg = 'editor (%s): %s%s' % (who, ', '.join(parts), ('\n\n' + note) if note else '')
    run(wt, '-c', 'user.name=pabloati', '-c', 'user.email=pabloatienzalo@gmail.com', 'commit', '-q', '-m', msg)
    sha = run(wt, 'rev-parse', '--short', 'HEAD').strip()
    pushed = None
    if payload.get('push'):
        try:
            run(wt, 'push', '-q', '-u', 'origin', branch)
            pushed = True
        except EditorError as e:
            pushed = str(e)
    return {'ok': True, 'commit': sha, 'files': files, 'pushed': pushed}
