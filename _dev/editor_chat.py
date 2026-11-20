"""The site editor's chat: someone writes a request in the editor, Claude Code carries it out on the open branch.

Claude runs headless (`claude -p`) in the branch's worktree with only the file tools (Read, Glob, Grep, Edit,
Write): no shell, no web, no MCP servers, no user settings. chat_guard.py (a PreToolUse hook) keeps every path
inside that worktree and keeps writes out of _dev/, .github/ and .claude/, so a request can change the site and
nothing else.

One request runs at a time on the whole server. While it runs, serve.py refuses the other writes on that branch
(save, go back, sync, publish). When Claude ends well, the files it changed become one save of the branch, like
«Guardar»: new ?v= stamps, a commit `editor (<name>): Claude: <request>`, a push if «Subir» is ticked. So the
Historial tab shows it and «Volver a este punto» undoes it. A request that is stopped, times out or fails leaves
the branch as it was. `main` is refused: it is the published site, so Claude works on a branch and a person
publishes it.

Each branch has its own conversation (with the Claude session id, so a follow-up keeps the context), kept in
<git dir>/boda-chat/<branch>.json, outside the tracked files. «Nueva conversación» archives it.

Needs the `claude` program on the machine that runs the server, logged in (on a computer: `claude` once; in the
container: CLAUDE_CODE_OAUTH_TOKEN, see _dev/compartir.md). Without it the editor shows no chat button.
Environment: BODA_CLAUDE (path to the program, or "off"), BODA_CLAUDE_MODEL (default opus),
BODA_CLAUDE_UNTIL (unix time after which the chat is off; the container sets it to 30 days after the token).
"""
import datetime
import json
import os
import re
import shutil
import signal
import subprocess
import threading
import time

import editor_api

DEV = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get('BODA_CLAUDE_MODEL', 'opus')
TIMEOUT = 10 * 60
MAX_MESSAGE = 4000
TOOLS = 'Read,Glob,Grep,Edit,Write'
SETTINGS = {'hooks': {'PreToolUse': [{'matcher': '*', 'hooks': [
    {'type': 'command', 'command': 'python3 %s' % os.path.join(DEV, 'chat_guard.py')}]}]}}

LOCK = threading.Lock()
JOB = {'proc': None}     # the running request: proc, branch, wt, steps, text, started, message, who, push, stopped, before


class Busy(editor_api.EditorError):
    pass


def until():
    """The moment (unix time) the chat turns itself off, or None: the container's token is used for a
    month from the day it was written (BODA_CLAUDE_UNTIL, set by _dev/docker/run.sh)."""
    try:
        return int(os.environ.get('BODA_CLAUDE_UNTIL') or 0) or None
    except ValueError:
        return 1          # unreadable: treat as expired


def claude_bin():
    c = os.environ.get('BODA_CLAUDE', '')
    u = until()
    if c == 'off':
        return None
    if u and time.time() >= u:
        os.environ.pop('CLAUDE_CODE_OAUTH_TOKEN', None)     # expired: the server forgets the token too
        return None
    c = c or shutil.which('claude') or os.path.expanduser('~/.local/bin/claude')
    return c if os.path.isfile(c) and os.access(c, os.X_OK) else None


def busy_branch():
    with LOCK:
        return JOB['branch'] if JOB['proc'] else None


# ---------- the conversation of a branch ----------

def _file(repo, branch):
    common = editor_api.run(repo, 'rev-parse', '--path-format=absolute', '--git-common-dir').strip()
    return os.path.join(common, 'boda-chat', branch.replace('/', '~') + '.json')


def _load(repo, branch):
    try:
        with open(_file(repo, branch), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'session': None, 'turns': []}


def _store(repo, branch, chat):
    path = _file(repo, branch)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(chat, f, ensure_ascii=False)
    os.chmod(path, 0o600)


def _branch(branch):
    if not isinstance(branch, str) or not editor_api.BRANCH.match(branch):
        raise editor_api.EditorError('Nombre de rama no válido')
    return branch


def status(repo, branch):
    if not claude_bin():
        return {'available': False}
    chat = _load(repo, _branch(branch))
    with LOCK:
        running = JOB['branch'] if JOB['proc'] else None
        live = None
        if running == branch:
            live = {'steps': JOB['steps'][-12:], 'text': JOB['text'], 'started': JOB['started'], 'message': JOB['message']}
    return {'available': True, 'turns': chat['turns'], 'running': live is not None, 'live': live,
            'busy': running if running and running != branch else None, 'model': MODEL, 'until': until()}


def new_chat(repo, branch):
    _branch(branch)
    if busy_branch() == branch:
        raise Busy('Claude sigue trabajando: páralo antes')
    chat = _load(repo, branch)
    if chat['turns']:
        path = _file(repo, branch)
        os.replace(path, path[:-5] + time.strftime('.%Y%m%d-%H%M%S.json'))
    return {'ok': True}


# ---------- running a request ----------

def system_prompt(wt, branch, who, view):
    t = datetime.date.today()
    try:
        with open(os.path.join(wt, 'CLAUDE.md'), encoding='utf-8') as f:
            project = f.read()
    except OSError:
        project = ''
    seeing = []
    if view.get('device') in ('móvil', 'escritorio'):
        seeing.append('the %s view' % ('phone' if view['device'] == 'móvil' else 'desktop'))
    if re.fullmatch(r'[\w.-]{1,60}', str(view.get('section') or '')):
        seeing.append('around the section `#%s`' % view['section'])
    if re.fullmatch(r'[\w.-]{1,80}', str(view.get('text') or '')):
        seeing.append('with the text `data-i18n="%s"` selected' % view['text'])
    where = (' They are looking at ' + ', '.join(seeing) + ', so "this" or "here" may refer to it.') if seeing else ''
    return f"""You are answering from the chat panel inside the wedding site's editor (a web page the couple uses \
to change their wedding invitation). Today is {t.isoformat()}. The person writing signs as "{who}". It may be Pablo \
or his partner, who is not a programmer: answer in the language they write in (Spanish by default), in plain \
words, short, without git or code jargon unless they use it first.{where}

What you can do here: read the files of the branch `{branch}` (your working directory is its folder) with Read, \
Glob and Grep, and change the site with Edit and Write: `index.html`, `css/`, `js/`, `docs/`, text files in \
`assets/`. Nothing else. There is no shell, no web access, no image tools and no git; `_dev/` (the editor itself), \
`.github/` and `.claude/` are read-only, and everything outside this folder is blocked. If a request needs any of \
that (a new photo or drawing, the editor's own behaviour, the RSVP sheet, publishing), say so plainly and say it \
is a job for Pablo in a Claude Code session.

- When you finish, the editor saves the files you changed as one save of this branch (it stamps the `?v=` \
cache-busters and commits by itself, so never touch `?v=` values and never mention commits). The person sees the \
result in the editor at once, and can undo it from the «Historial» tab with «Volver a este punto». Nothing reaches \
the guests until a person presses «Publicar».
- The editor owns three generated files: `css/editor.css` (colours, fonts, section order, backgrounds, spacing, \
moved and styled texts), `js/flores-layout.js` (the flowers) and the `?v=` stamps. Do not edit them. What they \
cover is done faster in the editor's own tabs: say which tab. Put your own CSS in `css/styles.css`; remember that \
`css/editor.css` loads after it and wins when both set the same thing.
- Follow the project's rules below: every guest-facing text is Spanish (tú, sentence case) with its English in \
`js/i18n.js` in the same change; no icons, cards or badges; the scripts stay null-guarded; user text goes through \
`escapeHtml()`. Do not invent facts about the wedding (dates, places, names, jokes): ask.
- Read a file before changing it and change only what the request needs. The page is mobile first: think of a \
390 px wide phone, then the desktop.
- If the request is ambiguous and a wrong guess would make a mess, ask first and change nothing. For small things \
pick the sensible option and say which.
- End with a short reply: what you changed, where to look at it, and anything you were not sure about.

# The project's own notes (CLAUDE.md; the parts about commands, git and Playwright do not apply in this chat)

{project}
"""


def start(repo, branch, payload):
    """Start a request on a branch. Raises EditorError (or Busy) when it cannot start."""
    binary = claude_bin()
    if not binary:
        raise editor_api.EditorError('Este servidor no tiene Claude instalado')
    _branch(branch)
    message = str(payload.get('message') or '').strip()
    if not message:
        raise editor_api.EditorError('Escribe algo primero')
    if len(message) > MAX_MESSAGE:
        raise editor_api.EditorError('El mensaje es demasiado largo (máximo %d letras)' % MAX_MESSAGE)
    if branch == 'main':
        raise editor_api.EditorError('Estás en main, que es la web publicada: abre una rama (arriba), pídeselo a Claude ahí y luego publícala')
    who = editor_api._who(payload)
    view = payload.get('view') if isinstance(payload.get('view'), dict) else {}
    wt = editor_api.open_branch(repo, branch)
    with editor_api.branch_lock(branch), LOCK:
        if JOB['proc']:
            raise Busy('Claude está ocupado con otra petición (rama %s): espera a que termine' % JOB['branch'])
        editor_api.check_head(wt, payload)
        if editor_api.run(wt, 'status', '--porcelain', '--untracked-files=no').strip():
            raise editor_api.EditorError('La carpeta de esta rama tiene cambios sin guardar hechos fuera del editor: guárdalos o descártalos antes')
        chat = _load(repo, branch)
        args = [binary, '-p', '--output-format', 'stream-json', '--verbose', '--tools', TOOLS,
                '--strict-mcp-config', '--setting-sources', '', '--permission-mode', 'acceptEdits',
                '--settings', json.dumps(SETTINGS), '--model', MODEL,
                '--append-system-prompt', system_prompt(wt, branch, who, view)]
        if chat.get('session'):
            args += ['--resume', chat['session']]
        # Claude's process gets no editor secret (the password) and is told where it may work
        env = {k: v for k, v in os.environ.items() if not k.startswith('BODA_')}
        env.update(BODA_CHAT_ROOT=os.path.realpath(wt), DISABLE_AUTOUPDATER='1',
                   PATH='%s:%s' % (os.path.dirname(binary), os.environ.get('PATH', '/usr/bin:/bin')))
        proc = subprocess.Popen(args, cwd=wt, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, encoding='utf-8', errors='replace', env=env, start_new_session=True)
        chat['turns'].append({'role': 'you', 'text': message, 'who': who, 'at': time.time()})
        _store(repo, branch, chat)
        JOB.update(proc=proc, repo=repo, branch=branch, wt=wt, steps=[], text='', started=time.time(), message=message,
                   who=who, push=bool(payload.get('push')), stopped=False, before=_untracked(wt))
    proc.stdin.write(message)     # on stdin, so a message that starts with "-" cannot pass for a flag
    proc.stdin.close()
    threading.Thread(target=_run, args=(proc,), daemon=True).start()
    return {'ok': True}


def stop():
    with LOCK:
        proc = JOB['proc']
        if not proc:
            return {'ok': False}
        JOB['stopped'] = True
    _kill(proc)
    return {'ok': True}


def _kill(proc):
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        pass


def _label(name, inp, wt):
    p = str(inp.get('file_path') or inp.get('path') or '')
    if p:
        rel = os.path.relpath(os.path.join(wt, p), wt)
        p = rel if not rel.startswith('..') else os.path.basename(p)
    return {'Read': 'Leyendo %s' % p, 'Edit': 'Cambiando %s' % p, 'MultiEdit': 'Cambiando %s' % p,
            'Write': 'Escribiendo %s' % p,
            'Glob': 'Buscando archivos %s' % inp.get('pattern', ''),
            'Grep': 'Buscando «%s»%s' % (str(inp.get('pattern', ''))[:60], (' en ' + p) if p else '')}.get(name, name)


def _run(proc):
    timer = threading.Timer(TIMEOUT, _kill, args=(proc,))
    timer.start()
    session, result, error, raw = None, None, None, []
    wt = JOB['wt']
    try:
        for line in proc.stdout:
            try:
                ev = json.loads(line)
            except ValueError:
                raw.append(line.strip())
                continue
            if not isinstance(ev, dict):
                continue
            kind = ev.get('type')
            if kind == 'system' and ev.get('subtype') == 'init':
                session = ev.get('session_id')
            elif kind == 'assistant':
                for b in (ev.get('message') or {}).get('content') or []:
                    with LOCK:
                        if b.get('type') == 'text' and (b.get('text') or '').strip():
                            JOB['text'] = b['text']
                        elif b.get('type') == 'tool_use':
                            JOB['steps'].append(_label(b.get('name', ''), b.get('input') or {}, wt))
            elif kind == 'result':
                session = ev.get('session_id') or session
                result = ev.get('result')
                if ev.get('is_error'):
                    error = result or ev.get('subtype') or 'Claude se ha parado con un error'
                    result = None
        proc.wait()
    except Exception as e:      # whatever happens, the job must end and free the branch
        error = 'Error interno del chat: %s' % e
        _kill(proc)
    finally:
        timer.cancel()
    with LOCK:
        job = dict(JOB)
    if result is None and not error:
        error = ('Parado: no se ha cambiado nada.' if job['stopped']
                 else 'Claude ha tardado más de %d minutos y lo he parado: no se ha cambiado nada.' % (TIMEOUT // 60)
                 if time.time() - job['started'] >= TIMEOUT
                 else 'Claude ha terminado sin contestar. ' + ' '.join(raw[-3:])[:400])
    turn = {'role': 'claude', 'text': result or '', 'error': error, 'steps': job['steps'], 'changed': [],
            'commit': None, 'pushed': None, 'at': time.time()}
    try:
        with editor_api.branch_lock(job['branch']):
            if error:
                _discard(wt, job['before'])
                if not job['stopped'] and job['text'] and not turn['text']:
                    turn['text'] = job['text']
            else:
                turn.update(_record(wt, job))
    except Exception as e:
        turn['error'] = 'No se han podido guardar los cambios de Claude: %s' % e
        try:
            _discard(wt, job['before'])
        except Exception:
            pass
    try:
        chat = _load(job['repo'], job['branch'])
        if session:
            chat['session'] = session
        chat['turns'].append(turn)
        _store(job['repo'], job['branch'], chat)
    finally:
        with LOCK:
            JOB['proc'] = None


# ---------- what the request changed: one save, or nothing ----------

def _untracked(wt):
    out = editor_api.run(wt, '-c', 'core.quotepath=off', 'ls-files', '--others', '--exclude-standard', '-z')
    return {p for p in out.split('\0') if p}


def _modified(wt):
    out = editor_api.run(wt, '-c', 'core.quotepath=off', 'diff', '--name-only', '-z', 'HEAD')
    return [p for p in out.split('\0') if p]


def _discard(wt, before):
    """Put the folder back as the branch has it: tracked files restored, files Claude created removed."""
    editor_api.run(wt, 'checkout', '-q', 'HEAD', '--', '.')
    for p in _untracked(wt) - before:
        try:
            os.remove(os.path.join(wt, p))
        except OSError:
            pass


def _record(wt, job):
    """Commit the files Claude changed as one save of the branch. Returns the fields of the chat turn."""
    paths = sorted(set(_modified(wt)) | (_untracked(wt) - job['before']))
    if not paths:
        return {}
    if any(p.startswith(('css/', 'js/')) for p in paths):
        paths = sorted(set(paths) | set(editor_api.bump(wt, [])))
    editor_api.run(wt, 'add', '--', *paths)
    if not editor_api.run(wt, 'diff', '--cached', '--name-only').strip():
        return {}
    ask = re.sub(r'\s+', ' ', job['message'])
    msg = 'editor (%s): Claude: %s\n\n%s' % (job['who'], ask[:60] + ('…' if len(ask) > 60 else ''), job['message'][:1500])
    out = editor_api._commit(wt, job['branch'], msg, job['push'])
    return {'changed': paths, 'commit': out['commit'], 'pushed': out['pushed']}
