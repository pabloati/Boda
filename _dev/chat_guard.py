#!/usr/bin/env python3
"""PreToolUse hook for the site editor's chat (see editor_chat.py): Claude may only use the file tools, only
inside the branch folder named by BODA_CHAT_ROOT, and may not write to the editor's own code.

Claude Code sends the tool call as JSON on stdin; exit code 2 blocks it and the stderr text goes back to Claude.
Anything that is not a known file tool is blocked too, so a tool added later does not slip past the guard.
No BODA_CHAT_ROOT means the hook is not running for the chat: everything is blocked."""
import json
import os
import sys

ROOT = os.path.realpath(os.environ.get('BODA_CHAT_ROOT') or '/nonexistent')
READ = {'Read', 'Glob', 'Grep'}
WRITE = {'Edit', 'Write', 'MultiEdit'}
HIDDEN = {'.git', '.claude'}               # never, not even to read: git's files and the other branches' folders
READ_ONLY = {'_dev', '.github'}            # the editor and the deploy set-up: code that runs on the server
READ_ONLY_FILES = {'css/editor.css', 'js/flores-layout.js'}   # written by the editor's own tabs


def block(why):
    print('Blocked by the site editor: %s. In this chat you can only read the files of this branch (%s) and '
          'change the site (index.html, css/, js/, docs/, assets/).' % (why, ROOT), file=sys.stderr)
    sys.exit(2)


def rel(p):
    """The path relative to ROOT with symlinks followed, or None when it leads outside."""
    p = os.path.expanduser(str(p))
    full = os.path.realpath(p if os.path.isabs(p) else os.path.join(os.getcwd(), p))
    if full == ROOT:
        return ''
    if not full.startswith(ROOT + os.sep):
        return None
    return os.path.relpath(full, ROOT)


try:
    ev = json.load(sys.stdin)
except ValueError:
    block('the tool call could not be read')
tool, inp = ev.get('tool_name', ''), ev.get('tool_input') or {}
if not os.path.isdir(ROOT):
    block('the chat has no folder to work in')
if tool not in READ | WRITE:
    block('the %s tool is not available here' % tool)
if os.path.realpath(os.getcwd()) != ROOT:
    block('the working directory is not the branch folder')
for key in ('file_path', 'notebook_path', 'path'):
    if not inp.get(key):
        continue
    r = rel(inp[key])
    if r is None:
        block('%s is outside this branch' % inp[key])
    parts = r.split(os.sep) if r else []
    if HIDDEN & set(parts):
        block('%s is not part of the site' % inp[key])
    if tool in WRITE:
        if not parts:
            block('that is the folder itself')
        if parts[0] in READ_ONLY:
            block('%s/ is read-only here (it is the editor, not the site)' % parts[0])
        if r.replace(os.sep, '/') in READ_ONLY_FILES:
            block('%s is written by the editor\'s own tabs' % r)
if tool in WRITE and not inp.get('file_path'):
    block('no file given')
v = str(inp.get('pattern') if tool == 'Glob' else inp.get('glob') if tool == 'Grep' else '') or ''
if v.startswith(('/', '~')) or {'..'} & set(v.split('/')):     # a pattern is a path too: no absolute ones, no climbing out
    block('the pattern %s reaches outside this branch' % v)
if HIDDEN & set(v.split('/')):
    block('the pattern %s is not part of the site' % v)
sys.exit(0)
