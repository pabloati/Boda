"""Back end of the site editor (_dev/flores.html), used by _dev/serve.py.

The editor works on one branch at a time. Each branch is edited in its own worktree (created on
demand under .claude/worktrees/ed-<branch>), and "Guardar" writes the changed files there and
commits them on that branch (and pushes it, if asked). Saving and going back only touch the branch
that is open (which can be main itself, when someone opens "(web publicada)" to save on it; going back
refuses main). The exception is publish(): it merges the branch into main and pushes main, which
deploys the public site at once.

What the editor can change, and where it lands:
  flowers   js/flores-layout.js                       (generated)
  texts     index.html (Spanish, inside data-i18n elements) and js/i18n.js (English map)
  look      css/editor.css: palette tokens, fonts, photo framing, section order, visibility,
            background and spacing, moved and styled texts (generated)
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
import threading

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


class Conflict(EditorError):
    """The branch moved on since the editor opened it (someone else saved). serve.py answers 409."""
    def __init__(self, head, msg='La rama ha cambiado desde que la abriste (otro ordenador ha guardado).'):
        super().__init__(msg)
        self.head = head


SHA = re.compile(r'^[0-9a-f]{7,40}$')


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


# Section background and spacing (Secciones tab), mirrored by sectionCSS() in _dev/editor-site.js.
# Verde reproduces the olive band of #rsvp (.band-olive, .band-olive p, .band-olive .link-button,
# .h-script.light and its wash), plus the texts in ON_OLIVE so they stay readable on green.
# Papel / Papel oscuro undo that cream text on a section that was green (#intro, #rsvp, the footer).
# Text inside a .paper-panel (the RSVP form, the playlist card) keeps its own colours.
# The colour rules weigh one id plus one class (:where() adds nothing), so they beat styles.css
# (classes only) but not a text's own colour from the Flores view, written after them.
BG = {'paper': 'var(--paper)', 'alt': 'var(--paper-deep)', 'olive': 'var(--olive)'}
SPACE = {-1: 0.6, 0: 1, 1: 1.5}
WASH = {'light': 'rgba(243, 238, 227, 0.16) 0%, rgba(243, 238, 227, 0) 68%',     # .h-script.light::before
        'paper': 'var(--olive-wash) 0%, rgba(142, 145, 102, 0) 68%'}             # .h-script::before
OUT = ':not(.paper-panel *)'
# texts that turn cream on green (the ones styles.css colours with ink, ink-faint or olive-deep)
ON_OLIVE = 'p, h1, h2, h3, h4, li, .h-script, .link-button, .text-link, .section-note, .countdown-number, .countdown-label, .ruta-time, .iban-code, .hashtag-text'


def _pad(s):
    """Vertical padding of a section in styles.css: ([top, bottom] wide screens, [top, bottom] phones)."""
    if s == 'intro':
        return [64, 64], [48, 48]
    if s == 'footer':
        return [64, 48], [64, 48]
    return [72, 72], [52, 52]


def section_css(S, s, bg, space):
    """CSS for one section (selector S, id s): background paper | alt | olive, spacing [top, bottom] in -1, 0, 1."""
    css = []
    if bg == 'olive':
        css.append('%s { background: var(--olive); color: var(--cream-text); }' % S)
        css.append('%s :where(%s)%s { color: var(--cream-text); }' % (S, ON_OLIVE, OUT))
        css.append('%s .h-script::before { background: radial-gradient(ellipse at 50%% 60%%, %s); }' % (S, WASH['light']))
    elif bg in BG:
        css.append('%s { background: %s; color: var(--ink); }' % (S, BG[bg]))
        css.append('%s:where(.band-olive, .intro-band) :where(p)%s { color: var(--ink-soft); }' % (S, OUT))
        css.append('%s :where(.h-script.light) { color: var(--ink); }' % S)
        css.append('%s .h-script.light::before { background: radial-gradient(ellipse at 50%% 60%%, %s); }' % (S, WASH['paper']))
        css.append('%s:where(.band-olive) :where(.link-button)%s { color: var(--terracotta); }' % (S, OUT))
    if space and any(space):
        def decl(pad):
            return '; '.join('padding-%s: %dpx' % (side, round(pad[i] * SPACE[space[i]]))
                             for i, side in enumerate(('top', 'bottom')) if space[i])
        wide, phone = _pad(s)
        css.append('%s { %s; }' % (S, decl(wide)))
        css.append('@media (max-width: 768px) {\n  %s { %s; }\n}' % (S, decl(phone)))
    return css


def write_look(wt, look):
    """look: {tokens: {name: color}, frame: {slot: [x, y]}, order: [ids], hidden: [ids],
    text: {key: {x, y, z, size?, color?, align?, font?, d?: {same}}}, palettes: [{name, tokens}],
    fonts: {serif?, script?, hand?: family from FONTS},
    bg: {section: 'paper' | 'alt' | 'olive'}, space: {section: [top, bottom]} with -1 | 0 | 1}."""
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
    raw_bg, raw_space = look.get('bg'), look.get('space')
    raw_bg = raw_bg if isinstance(raw_bg, dict) else {}
    raw_space = raw_space if isinstance(raw_space, dict) else {}
    bg = {s: raw_bg[s] for s in SECTIONS if raw_bg.get(s) in BG}
    space = {}
    for s in SECTIONS:
        v = raw_space.get(s)
        if isinstance(v, list) and len(v) == 2 and all(type(x) is int and x in SPACE for x in v) and any(v):
            space[s] = v
    state = {'tokens': tokens, 'frame': frame, 'order': order, 'hidden': hidden, 'text': text, 'palettes': palettes,
             'fonts': fonts, 'bg': bg, 'space': space}
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
    for s in SECTIONS:
        css.extend(section_css(sel(s), s, bg.get(s), space.get(s)))
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

# One lock per branch: the stale-head check and the write + commit that follow it run as one step, so
# two saves (or a save and a go-back) on the same branch at once cannot both pass check_head.
_BRANCH_LOCKS = {}
_BRANCH_LOCKS_GUARD = threading.Lock()


def branch_lock(branch):
    with _BRANCH_LOCKS_GUARD:
        return _BRANCH_LOCKS.setdefault(branch, threading.Lock())


def _stamp(wt):
    """A ?v= value no earlier save used: the minute plus the commit the new one goes on top of (each
    save and each go-back has a different one), so a go-back made in the same minute as the save it
    undoes still gives every link a new URL and visitors do not keep the undone files cached."""
    base = datetime.datetime.now().strftime('%Y%m%d%H%M') + '-' + head(wt)
    used = set()
    for name in REPO_FILES:
        path = os.path.join(wt, name)
        if os.path.exists(path):
            used.update(re.findall(r'\?v=([\w-]+)', open(path, encoding='utf-8').read()))
    stamp, n = base, 1
    while stamp in used:
        n += 1
        stamp = '%s-%d' % (base, n)
    return stamp


def bump(wt, photos):
    """New ?v= on css/js links (and on the changed photos), so visitors never mix old and new files."""
    stamp = _stamp(wt)
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


def _who(payload):
    return re.sub(r'[^\w áéíóúñÁÉÍÓÚÑ.-]', '', str(payload.get('who') or ''))[:40].strip() or 'editor'


def save(repo, branch, payload, write_flores):
    wt = open_branch(repo, branch)
    with branch_lock(branch):
        return _save(wt, branch, payload, write_flores)


def _save(wt, branch, payload, write_flores):
    check_head(wt, payload)
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
        return {'ok': True, 'commit': None, 'files': [], 'head': head(wt)}
    run(wt, 'add', '--', *files)
    if not run(wt, 'diff', '--cached', '--name-only').strip():
        return {'ok': True, 'commit': None, 'files': [], 'head': head(wt)}
    note = re.sub(r'[\r\n]+', ' ', str(payload.get('message') or ''))[:200]
    msg = 'editor (%s): %s%s' % (_who(payload), ', '.join(parts), ('\n\n' + note) if note else '')
    out = _commit(wt, branch, msg, payload.get('push'))
    out['files'] = files
    return out


def _commit(wt, branch, msg, push):
    """Commit what is staged (as pabloati) and push the branch if asked. The push error, if any, goes back as text."""
    run(wt, '-c', 'user.name=pabloati', '-c', 'user.email=pabloatienzalo@gmail.com', 'commit', '-q', '-m', msg)
    sha = head(wt)
    pushed = None
    if push:
        try:
            run(wt, 'push', '-q', '-u', 'origin', branch)
            pushed = True
        except EditorError as e:
            pushed = str(e)
    return {'ok': True, 'commit': sha, 'pushed': pushed, 'head': sha}


# ---------- history: list, stale-branch check, go back to a commit ----------

def head(wt):
    return run(wt, 'rev-parse', '--short', 'HEAD').strip()


def check_head(wt, payload):
    """Refuse to write when the client opened an older HEAD than the worktree has now, unless payload.force.
    A client that sends no head (older editor) is not checked."""
    h = payload.get('head')
    if not h or payload.get('force'):
        return
    if not SHA.match(str(h)):
        raise EditorError('Versión de la rama no válida')
    full = run(wt, 'rev-parse', 'HEAD').strip()
    if not full.startswith(h):
        raise Conflict(head(wt))


def history(repo, branch, n=40):
    """The branch's last n commits: sha, who, date (unix), subject, files touched, made by the editor or not."""
    wt = open_branch(repo, branch)
    out = run(wt, '-c', 'core.quotepath=off', 'log', '-n', str(n), '--name-only',
              '--format=%x1e%H%x1f%h%x1f%an%x1f%at%x1f%P%x1f%s')
    commits = []
    for rec in out.split('\x1e')[1:]:
        lines = rec.split('\n')
        f = lines[0].split('\x1f')
        if len(f) < 6:
            continue
        subject = f[5]
        m = re.match(r'^editor \(([^)]*)\):', subject)
        commits.append({
            'sha': f[0], 'short': f[1], 'author': f[2], 'date': int(f[3] or 0), 'merge': len(f[4].split()) > 1,
            'subject': subject, 'who': m.group(1) if m else f[2],
            'editor': bool(m) or subject.startswith('publicar:'),
            'files': [x for x in lines[1:] if x.strip()][:50],
        })
    return {'branch': branch, 'head': head(wt), 'commits': commits}


def revert(repo, branch, payload):
    """Put the branch's files back as they were at an older commit of the same branch, as one new commit
    on top (nothing is rewritten). Refuses if the worktree has changes nobody committed."""
    sha = str(payload.get('sha') or '')
    if not SHA.match(sha):
        raise EditorError('Versión no válida')
    if branch == 'main':
        # main is the public site: going back on it would deploy an old site without Publicar's checks
        raise EditorError('Estás en main, que es la web publicada: para volver atrás, hazlo en una rama y publícala, o %s' % ASK)
    wt = open_branch(repo, branch)
    with branch_lock(branch):
        return _revert(wt, branch, sha, payload)


def _revert(wt, branch, sha, payload):
    check_head(wt, payload)
    r = subprocess.run(['git', '-C', wt, 'merge-base', '--is-ancestor', sha, 'HEAD'], capture_output=True, text=True)
    if r.returncode == 1:
        raise EditorError('Esa versión no es de esta rama')
    if r.returncode:
        raise EditorError('No encuentro esa versión')
    if run(wt, 'status', '--porcelain', '--untracked-files=no').strip():
        raise EditorError('La carpeta de esta rama tiene cambios sin guardar hechos fuera del editor: guárdalos o descártalos antes')
    short = run(wt, 'rev-parse', '--short', sha).strip()
    subject = run(wt, 'log', '-1', '--format=%s', sha).strip()
    run(wt, 'read-tree', '-m', '-u', sha)          # index and files as at sha; files added since are removed
    try:
        changed = run(wt, '-c', 'core.quotepath=off', 'diff', '--cached', '--name-only').split('\n')
        changed = [f for f in changed if f]
        if not changed:
            return {'ok': True, 'commit': None, 'head': head(wt)}
        # new ?v= on the links, so visitors who already have the newer css/js/photos cached get the old ones back
        photos = [f for f in changed if f in PHOTOS.values()]
        if photos or any(f.startswith(('css/', 'js/')) for f in changed):
            bumped = bump(wt, photos)
            if bumped:
                run(wt, 'add', '--', *bumped)
        subject = re.sub(r'\s+', ' ', subject)
        msg = 'editor (%s): volver a %s (%s)' % (_who(payload), short, subject[:72] + ('…' if len(subject) > 72 else ''))
        return _commit(wt, branch, msg, payload.get('push'))
    except Exception:
        # nothing was committed: put the folder back as the branch has it (it was clean, checked above)
        subprocess.run(['git', '-C', wt, 'read-tree', '-m', '-u', 'HEAD'], capture_output=True)
        raise


# ---------- publish: merge a branch into main and push main (that publishes the site) ----------

PUBLISH_LOCK = threading.Lock()
IDENT = ('-c', 'user.name=pabloati', '-c', 'user.email=pabloatienzalo@gmail.com')
ASK = 'pide a Pablo que lo revise'


def _has(repo, ref):
    try:
        run(repo, 'rev-parse', '--verify', '-q', ref + '^{commit}')
        return True
    except EditorError:
        return False


def _count(repo, rng):
    return int(run(repo, 'rev-list', '--count', rng).strip() or 0)


def _publish_branch(repo, branch):
    if not isinstance(branch, str) or not BRANCH.match(branch) or branch.startswith(('-', '.')) or '..' in branch or branch.endswith('.lock'):
        raise EditorError('Nombre de rama no válido')
    try:
        run(repo, 'check-ref-format', '--branch', branch)
    except EditorError:
        raise EditorError('Nombre de rama no válido')
    if branch == 'main':
        raise EditorError('Estás en main, que ya es la web publicada: abre la rama con los cambios que quieres publicar')
    return branch


def publish_plan(repo, branch, fetch=True):
    """Dry run: what publishing <branch> would put on main, and anything that stops it.
    Commits are the ones on the branch that origin/main does not have yet, newest first."""
    _publish_branch(repo, branch)
    fetched = False
    if fetch:
        try:
            run(repo, 'fetch', '-q', 'origin')
            fetched = True
        except EditorError:
            pass
    local, remote = 'refs/heads/' + branch, 'refs/remotes/origin/' + branch
    has_local, has_remote = _has(repo, local), _has(repo, remote)
    if not (has_local or has_remote):
        raise EditorError('La rama %s no existe' % branch)
    base = 'refs/remotes/origin/main' if _has(repo, 'refs/remotes/origin/main') else 'refs/heads/main'
    if not _has(repo, base):
        raise EditorError('No encuentro la rama main')
    ref = local if has_local else remote
    problem = None
    if base != 'refs/heads/main' and _has(repo, 'refs/heads/main'):
        ahead = _count(repo, base + '..refs/heads/main')
        if ahead:
            problem = 'main tiene %d cambio(s) en este ordenador que no están en GitHub: %s antes de publicar.' % (ahead, ASK)
    if not problem and has_local and has_remote and _count(repo, local + '..' + remote):
        problem = 'La rama %s tiene en GitHub cambios que no están en el editor: %s antes de publicar.' % (branch, ASK)
    wt_main = worktree_map(repo).get('main')
    if not problem and wt_main and run(wt_main, 'status', '--porcelain', '--untracked-files=no').strip():
        problem = 'La copia de main de este ordenador tiene cambios a medias: %s antes de publicar.' % ASK
    commits = []
    for line in run(repo, 'log', '--max-count=200', '--format=%h%x1f%an%x1f%aI%x1f%s', base + '..' + ref).splitlines():
        sha, author, when, subject = (line.split('\x1f') + ['', '', ''])[:4]
        m = re.match(r'^editor \(([^)]*)\)', subject)
        commits.append({'sha': sha, 'who': m.group(1) if m else author, 'when': when, 'subject': subject})
    push = has_local and (not has_remote or _count(repo, remote + '..' + local) > 0)
    tip = run(repo, 'rev-parse', ref).strip()
    return {'ok': True, 'branch': branch, 'commits': commits, 'upToDate': not commits, 'fetched': fetched,
            'problem': problem, 'pushBranch': push, 'tip': tip, '_ref': ref}


def publish(repo, branch, payload):
    """Push the branch if GitHub lacks some of it, bring main to origin/main, merge the branch into
    main (--no-ff) and push main. Any conflict or failed push leaves main as it was on GitHub.
    payload.tip is the branch commit the dry run showed (the editor sends it): if someone saved on the
    branch since, nothing is published (409) and the editor shows the new list to confirm again.
    Merges exactly that commit, so a save that lands while publishing is not published unseen."""
    with PUBLISH_LOCK, branch_lock('main'):
        plan = publish_plan(repo, branch)
        if not plan['fetched']:
            raise EditorError('No se pudo conectar con GitHub: prueba otra vez en un momento')
        tip = str(payload.get('tip') or '')
        if tip and tip != plan['tip']:
            raise Conflict(plan['tip'][:7], 'Alguien ha guardado en %s desde que revisaste la lista: '
                           'mira lo que se publicaría ahora y vuelve a confirmar.' % branch)
        if plan['problem']:
            raise EditorError(plan['problem'])
        if not plan['commits']:
            return {'ok': True, 'merged': [], 'commit': None, 'upToDate': True}
        plan['_ref'] = plan['tip']       # from here on, the commit that was checked, not the moving branch
        if plan['pushBranch']:
            ref = 'refs/heads/' + branch
            run(repo, 'push', '-q', 'origin', '%s:%s' % (plan['tip'], ref))
        wt = open_branch(repo, 'main')
        if run(wt, 'status', '--porcelain', '--untracked-files=no').strip():
            raise EditorError('La copia de main de este ordenador tiene cambios a medias: %s antes de publicar.' % ASK)
        try:
            run(wt, 'merge', '-q', '--ff-only', 'refs/remotes/origin/main')
        except EditorError:
            raise EditorError('main no se pudo poner al día con GitHub: %s antes de publicar.' % ASK)
        before = run(wt, 'rev-parse', 'HEAD').strip()
        msg = 'publicar: %s (editor, %s)' % (branch, _who(payload))
        try:
            run(wt, *IDENT, 'merge', '-q', '--no-ff', '--no-edit', '-m', msg, plan['_ref'])
        except EditorError as e:
            if _has(wt, 'MERGE_HEAD'):   # a real conflict: undo the half-done merge
                try:
                    run(wt, 'merge', '--abort')
                except EditorError:
                    run(wt, 'reset', '-q', '--merge', before)
                raise EditorError('No se pudo publicar: los cambios de %s chocan con lo que ya hay en la web. '
                                  'No se ha tocado nada; pide a Pablo que los una a mano.' % branch)
            raise EditorError('No se pudo publicar (%s). No se ha tocado nada: %s.' % (e, ASK))
        try:
            run(wt, 'push', '-q', 'origin', 'refs/heads/main:refs/heads/main')
        except EditorError as e:
            run(wt, 'reset', '-q', '--keep', before)
            raise EditorError('No se pudo subir main a GitHub (%s). No se ha publicado nada.' % e)
        return {'ok': True, 'merged': plan['commits'], 'commit': run(wt, 'rev-parse', '--short', 'HEAD').strip(),
                'branchPushed': plan['pushBranch']}
