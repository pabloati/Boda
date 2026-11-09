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

Listens on 127.0.0.1 only. Nothing here is published: GitHub Pages skips _dev/.
"""
import http.server
import json
import mimetypes
import os
import posixpath
import re
import subprocess
import sys
import urllib.parse

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
    return out


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
        self.route(body=True)

    def do_HEAD(self):
        self.route(body=False)

    def do_POST(self):
        """Only one write is allowed: the flower layout, from this page's own origin."""
        if urllib.parse.urlsplit(self.path).path != '/_dev/save-flores':
            return self.send_error(404)
        host = self.headers.get('Host', '').rsplit(':', 1)[0]
        if host not in ('localhost', '127.0.0.1') or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.send_error(403)
        n = int(self.headers.get('Content-Length') or 0)
        if n > 200000:
            return self.send_error(413)
        try:
            items = clean_flores(json.loads(self.rfile.read(n))['items'])
        except (ValueError, KeyError, TypeError):
            return self.send_error(400, 'Bad layout')
        lines = ',\n'.join('  ' + json.dumps(i, ensure_ascii=False, separators=(', ', ': ')) for i in items)
        with open(os.path.join(HERE, 'js', 'flores-layout.js'), 'w') as f:
            f.write('// Where the botanical plates sit on the page. Written by _dev/flores.html (the flower editor):\n'
                    '// edit it there, not by hand. Each item is anchored to the nearest edge of its section.\n'
                    'window.FLORES_LAYOUT = {"items": [\n%s\n]};\n' % lines)
        self.send_bytes(json.dumps({'ok': True, 'items': len(items)}).encode(), 'application/json', True)

    def route(self, body):
        p = urllib.parse.urlsplit(self.path).path
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
    print('Flower editor: http://localhost:%d/_dev/flores.html   (Ctrl+C to stop)' % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
