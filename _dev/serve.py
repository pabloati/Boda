#!/usr/bin/env python3
"""Local preview server for the wedding site: every worktree and branch on one port.

Use:   python3 _dev/serve.py [port]        (default 8000)
Open:  http://localhost:8000/_dev/phones.html  and pick a version at the top.

Routes
  /                    the worktree this script lives in (live files)
  /wt/<name>/...       another worktree, live files. <name> is its folder name;
                       "repo" is the main checkout (~/personal/Boda).
  /b/<branch>/...      a branch's last commit, read straight from git, for
                       branches no worktree has checked out ("/" in a branch
                       name is written "~": origin~redesign).
  /_dev/sources.json   the list of worktrees and branches the phone page shows.
  POST /_dev/save-flores   the flower editor (_dev/flores.html) writes js/flores-layout.js here.
  /_dev/api/...        the site editor: branches, open/create a branch, read texts and look, save
                       (writes into that branch's worktree and commits; see _dev/editor_api.py),
                       history of a branch and going back to one of its commits (POST revert).

Listens on 127.0.0.1 only. Nothing here is published: GitHub Pages skips _dev/.

Shared mode (to edit from another computer through a tunnel, see _dev/compartir.md):
  BODA_EDITOR_PASSWORD=... python3 _dev/serve.py [port]
  (or BODA_EDITOR_PASSWORD_FILE=path). Then every page, the editor and the API need a login at
  /_dev/login; a session lasts 30 days; 8 wrong passwords from one address lock it for 10 minutes.
"""
import hashlib
import hmac
import http.server
import json
import secrets
import threading
import time
import mimetypes
import os
import posixpath
import re
import subprocess
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import editor_api  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def git(*args, binary=False):
    r = subprocess.run(['git', '-C', HERE, *args], capture_output=True, text=not binary)
    return r


def worktrees():
    """[{name, branch, path}] from `git worktree list --porcelain`."""
    out, cur = [], {}
    for line in git('worktree', 'list', '--porcelain').stdout.splitlines() + ['']:
        if not line:
            if cur.get('worktree'):
                out.append(cur)
            cur = {}
            continue
        key, _, val = line.partition(' ')
        cur[key] = val
    res = []
    for i, w in enumerate(out):
        branch = w.get('branch', '').replace('refs/heads/', '') or '(sin rama)'
        name = 'repo' if i == 0 else os.path.basename(w['worktree'])
        res.append({'name': name, 'branch': branch, 'path': w['worktree']})
    return res


def sources():
    wts = worktrees()
    here = os.path.realpath(HERE)
    taken = {w['branch'] for w in wts}
    local = git('for-each-ref', '--format=%(refname:short)', 'refs/heads').stdout.split()
    remote = git('for-each-ref', '--format=%(refname:short)', 'refs/remotes').stdout.split()
    branches = [b for b in local if b not in taken]
    branches += [b for b in remote
                 if b != 'origin' and not b.endswith('/HEAD')
                 and b.split('/', 1)[-1] not in local and b.split('/', 1)[-1] not in taken]
    return {
        'worktrees': [{
            'name': w['name'], 'branch': w['branch'], 'live': True,
            'url': '/' if os.path.realpath(w['path']) == here else '/wt/%s/' % w['name'],
        } for w in wts],
        'branches': [{
            'branch': b, 'live': False, 'url': '/b/%s/' % b.replace('/', '~'),
            'rev': git('rev-parse', '--short', b).stdout.strip(),
        } for b in branches],
    }


def clean_place(p):
    """One placement: width, offsets from the nearest edges, turn."""
    ax, ay = p['x'], p['y']
    if ax['a'] not in ('l', 'r') or ay['a'] not in ('t', 'b'):
        raise ValueError
    return {'w': round(float(p['w']), 1), 'x': {'a': ax['a'], 'v': round(float(ax['v']), 1)},
            'y': {'a': ay['a'], 'v': round(float(ay['v']), 1)}, 'rot': round(float(p.get('rot') or 0), 1)}


def clean_flores(items):
    """Keeps only the fields the page reads, with the types it expects."""
    if not isinstance(items, list) or len(items) > 300:
        raise ValueError
    out = []
    for it in items:
        if not (re.fullmatch(r'[a-z0-9-]+', it['img']) and re.fullmatch(r'[a-z0-9-]+', it['sec'])):
            raise ValueError
        ax, ay = it['x'], it['y']
        if ax['a'] not in ('l', 'r') or ay['a'] not in ('t', 'b'):
            raise ValueError
        out.append({
            'id': str(it['id'])[:12], 'sec': it['sec'], 'img': it['img'], 'w': round(float(it['w']), 1),
            'x': {'a': ax['a'], 'v': round(float(ax['v']), 1)}, 'y': {'a': ay['a'], 'v': round(float(ay['v']), 1)},
            'flip': bool(it.get('flip')), 'flipY': bool(it.get('flipY')), 'rot': round(float(it.get('rot') or 0), 1),
            'front': bool(it.get('front')), 'hide': it.get('hide') if it.get('hide') in ('m', 'd') else '',
        })
        op = round(float(it.get('op', 1) or 1), 2)
        if op < 1:
            out[-1]['op'] = max(0.1, op)            # opacity
        if it.get('lock'):
            out[-1]['lock'] = True                   # editor only: cannot be dragged by mistake
        if it.get('d'):
            out[-1]['d'] = clean_place(it['d'])      # own placement on wide screens
    return out


# ---------- shared mode: password login ----------
def _password():
    pw = os.environ.get('BODA_EDITOR_PASSWORD', '')
    f = os.environ.get('BODA_EDITOR_PASSWORD_FILE', '')
    if not pw and f:
        with open(os.path.expanduser(f)) as fh:
            pw = fh.read().strip()
    return pw


PASSWORD = _password()
SESSIONS = {}                     # token -> expiry
FAILS = {}                        # address -> [timestamps of wrong passwords]
LOCK = threading.Lock()
SESSION_DAYS = 30

LOGIN_PAGE = '''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Editor de la boda</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3eee3;font:16px/1.4 system-ui,sans-serif;color:#3b382f}
form{background:#fffdf8;padding:28px 26px;border-radius:12px;box-shadow:0 10px 30px -12px rgba(0,0,0,.25);width:min(340px,90vw);display:grid;gap:12px}
h1{font-size:20px;margin:0}p{margin:0;color:#6f6a5c;font-size:14px}input{font:inherit;padding:10px;border:1px solid #d9d0ba;border-radius:8px}
button{font:inherit;padding:10px;border:0;border-radius:8px;background:#6c6f48;color:#fff;font-weight:600;cursor:pointer}.err{color:#a22}
</style></head><body><form method="post" action="/_dev/login"><h1>Editor de la boda</h1><p>Escribe la contraseña para entrar.</p>
%s<input type="password" name="password" autocomplete="current-password" autofocus required><button>Entrar</button></form></body></html>'''


def check_password(given):
    return bool(PASSWORD) and hmac.compare_digest(hashlib.sha256(given.encode()).digest(), hashlib.sha256(PASSWORD.encode()).digest())


def layout_js(items):
    lines = ',\n'.join('  ' + json.dumps(i, ensure_ascii=False, separators=(', ', ': ')) for i in items)
    return ('// Where the botanical plates sit on the page. Written by _dev/flores.html (the flower editor):\n'
            '// edit it there, not by hand. Each item is anchored to the nearest edge of its section.\n'
            'window.FLORES_LAYOUT = {"items": [\n%s\n]};\n' % lines)


def write_flores(wt, items):
    with open(os.path.join(wt, 'js', 'flores-layout.js'), 'w') as f:
        f.write(layout_js(clean_flores(items)))
    return 'js/flores-layout.js'


def wt_url(path):
    """URL prefix this server uses for a worktree folder."""
    if os.path.realpath(path) == os.path.realpath(HERE):
        return '/'
    root = editor_api.repo_root(HERE)
    return '/wt/%s/' % ('repo' if os.path.realpath(path) == os.path.realpath(root) else os.path.basename(path))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=HERE, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')   # always the files as they are now
        super().end_headers()

    def log_message(self, fmt, *args):   # quiet: only errors
        if args and str(args[1])[:1] in '45':
            super().log_message(fmt, *args)

    # live worktrees: map /wt/<name>/... onto that folder, then serve normally
    def translate_path(self, path):
        p = urllib.parse.urlsplit(path).path
        if p.startswith('/wt/'):
            parts = p.split('/', 3)
            rest = parts[3] if len(parts) > 3 else ''
            for w in worktrees():
                if w['name'] == parts[2]:
                    base = os.path.realpath(w['path'])
                    rest = posixpath.normpath('/' + urllib.parse.unquote(rest)).lstrip('/')
                    full = os.path.realpath(os.path.join(base, rest))
                    if full == base or full.startswith(base + os.sep):
                        return full
            return os.path.join(HERE, '.missing')
        return super().translate_path(path)

    def do_GET(self):
        if PASSWORD and self.gate():
            return
        self.route(body=True)

    def do_HEAD(self):
        if PASSWORD and self.gate():
            return
        self.route(body=False)

    def client(self):
        """The visitor's address: the tunnel passes it in a header."""
        return self.headers.get('CF-Connecting-IP') or self.headers.get('X-Forwarded-For', '').split(',')[0].strip() or self.client_address[0]

    def session_ok(self):
        if not PASSWORD:
            return True
        for part in self.headers.get('Cookie', '').split(';'):
            k, _, v = part.strip().partition('=')
            if k == 'boda_ed':
                with LOCK:
                    exp = SESSIONS.get(v)
                    if exp and exp > time.time():
                        return True
        return False

    def allowed(self):
        """Writes: JSON only; from this machine, or (shared mode) with a session and from this same site."""
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return False
        host = self.headers.get('Host', '')
        if not PASSWORD:
            return host.rsplit(':', 1)[0] in ('localhost', '127.0.0.1')
        origin = self.headers.get('Origin', '')
        return self.session_ok() and (not origin or urllib.parse.urlsplit(origin).netloc == host)

    def login(self):
        """GET shows the form; POST checks the password and starts a session."""
        if self.command == 'GET':
            return self.send_html(LOGIN_PAGE % '')
        ip, now = self.client(), time.time()
        with LOCK:
            recent = [t for t in FAILS.get(ip, []) if now - t < 600]
            FAILS[ip] = recent
        if len(recent) >= 8:
            return self.send_html(LOGIN_PAGE % '<p class="err">Demasiados intentos. Espera 10 minutos.</p>', 429)
        n = min(int(self.headers.get('Content-Length') or 0), 2000)
        form = urllib.parse.parse_qs(self.rfile.read(n).decode('utf-8', 'replace'))
        if not check_password((form.get('password') or [''])[0]):
            with LOCK:
                FAILS.setdefault(ip, []).append(now)
            time.sleep(1)
            return self.send_html(LOGIN_PAGE % '<p class="err">Contraseña incorrecta.</p>', 401)
        token = secrets.token_urlsafe(32)
        with LOCK:
            SESSIONS[token] = now + SESSION_DAYS * 86400
        secure = '; Secure' if self.headers.get('X-Forwarded-Proto', '') == 'https' or self.headers.get('CF-Visitor', '').find('https') >= 0 else ''
        self.send_response(303)
        self.send_header('Set-Cookie', 'boda_ed=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Strict%s' % (token, SESSION_DAYS * 86400, secure))
        self.send_header('Location', '/_dev/flores.html')
        self.end_headers()

    def send_html(self, text, status=200):
        data = text.encode()
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def gate(self):
        """Shared mode: everything except the login page needs a session. Returns True if handled."""
        p = urllib.parse.urlsplit(self.path).path
        if p == '/_dev/login':
            self.login()
            return True
        if not self.session_ok():
            if self.command == 'GET' and not p.startswith('/_dev/api/'):
                self.send_response(303); self.send_header('Location', '/_dev/login'); self.end_headers()
            else:
                self.send_error(401)
            return True
        return False

    def send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def api_post(self, p):
        n = int(self.headers.get('Content-Length') or 0)
        if n > 12_000_000:
            return self.send_error(413)
        try:
            req = json.loads(self.rfile.read(n) or b'{}')
            if p == '/_dev/api/open':
                wt = editor_api.open_branch(HERE, req['branch'])
                return self.send_json({'branch': req['branch'], 'url': wt_url(wt)})
            if p == '/_dev/api/branch':
                wt = editor_api.new_branch(HERE, req['name'], req['base'])
                return self.send_json({'branch': req['name'], 'url': wt_url(wt)})
            if p == '/_dev/api/save':
                return self.send_json(editor_api.save(HERE, req['branch'], req, write_flores))
            if p == '/_dev/api/revert':
                return self.send_json(editor_api.revert(HERE, req['branch'], req))
        except editor_api.Conflict as e:
            return self.send_json({'ok': False, 'error': str(e), 'head': e.head}, 409)
        except editor_api.EditorError as e:
            return self.send_json({'ok': False, 'error': str(e)}, 400)
        except (ValueError, KeyError, TypeError) as e:
            return self.send_json({'ok': False, 'error': 'Petición no válida: %s' % e}, 400)
        return self.send_error(404)

    def api_get(self, p, q):
        try:
            if p == '/_dev/api/branches':
                return self.send_json(editor_api.branches(HERE))
            if p == '/_dev/api/state':
                wt = editor_api.open_branch(HERE, q['branch'][0])
                if q.get('head'):         # the cheap variant the editor polls: has someone saved since?
                    return self.send_json({'head': editor_api.head(wt)})
                return self.send_json({'url': wt_url(wt), 'head': editor_api.head(wt),
                                       'texts': editor_api.read_texts(wt), 'look': editor_api.read_look(wt)})
            if p == '/_dev/api/history':
                return self.send_json(editor_api.history(HERE, q['branch'][0]))
        except editor_api.EditorError as e:
            return self.send_json({'ok': False, 'error': str(e)}, 400)
        except (KeyError, IndexError):
            return self.send_json({'ok': False, 'error': 'Falta la rama'}, 400)
        return self.send_error(404)

    def do_POST(self):
        """Writes: the flower layout (old route) and the site editor's API, from this machine only."""
        p = urllib.parse.urlsplit(self.path).path
        if PASSWORD and self.gate():
            return
        if not self.allowed():
            return self.send_error(403)
        if p.startswith('/_dev/api/'):
            return self.api_post(p)
        if p != '/_dev/save-flores':
            return self.send_error(404)
        n = int(self.headers.get('Content-Length') or 0)
        if n > 200000:
            return self.send_error(413)
        try:
            items = clean_flores(json.loads(self.rfile.read(n))['items'])
        except (ValueError, KeyError, TypeError):
            return self.send_error(400, 'Bad layout')
        with open(os.path.join(HERE, 'js', 'flores-layout.js'), 'w') as f:
            f.write(layout_js(items))
        self.send_bytes(json.dumps({'ok': True, 'items': len(items)}).encode(), 'application/json', True)

    def route(self, body):
        u = urllib.parse.urlsplit(self.path); p = u.path
        if p.startswith('/_dev/api/'):
            return self.api_get(p, urllib.parse.parse_qs(u.query))
        if p == '/_dev/sources.json':
            return self.send_bytes(json.dumps(sources()).encode(), 'application/json', body)
        if p.startswith('/b/'):
            return self.from_git(p, body)
        return (super().do_GET if body else super().do_HEAD)()

    def from_git(self, p, body):
        parts = p.split('/', 3)
        if len(parts) == 3:                       # /b/<branch> → /b/<branch>/ so relative links work
            self.send_response(301)
            self.send_header('Location', p + '/')
            return self.end_headers()
        branch = urllib.parse.unquote(parts[2]).replace('~', '/')
        known = {b['branch'] for b in sources()['branches']} | {w['branch'] for w in worktrees()}
        if branch not in known:
            return self.send_error(404, 'Unknown branch')
        rest = urllib.parse.unquote(parts[3])
        if rest == '' or rest.endswith('/'):
            rest += 'index.html'
        rest = posixpath.normpath('/' + rest).lstrip('/')
        r = git('show', '%s:%s' % (branch, rest), binary=True)
        if r.returncode:
            return self.send_error(404, '%s is not on %s' % (rest, branch))
        ctype = mimetypes.guess_type(rest)[0] or 'application/octet-stream'
        self.send_bytes(r.stdout, ctype, body)

    def send_bytes(self, data, ctype, body):
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if body:
            self.wfile.write(data)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
    except OSError:
        sys.exit('Port %d is busy: stop the other server (Ctrl+C in its terminal) or run: '
                 'python3 _dev/serve.py %d' % (port, port + 1))
    print('Site:          http://localhost:%d/' % port)
    print('Phone preview: http://localhost:%d/_dev/phones.html' % port)
    print('Site editor:   http://localhost:%d/_dev/flores.html   (Ctrl+C to stop)' % port)
    if PASSWORD:
        print('Shared mode: password required (/_dev/login).')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
