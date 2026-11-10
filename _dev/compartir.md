# Sharing the site editor

So that someone on another computer or phone can use the editor (`_dev/flores.html`) and save to a
branch, the dev server runs in **shared mode** behind a free Cloudflare quick tunnel.

## Start

```bash
bash _dev/compartir.sh          # from the worktree whose _dev/ you want to use (the editor branch)
```

It prints a link like `https://xxxx.trycloudflare.com/_dev/flores.html`. Send that link and the
password separately. The link stays valid while the script runs and changes every time it starts.

First time only: the script asks you to create the password file
(`~/.config/boda-editor/password`, mode 600) and downloads `cloudflared` to `~/.local/bin`.

## What protects it

- Every URL (the editor, the site, every branch) needs the password; without a session you only
  get the login page. Sessions last 30 days (HttpOnly, SameSite=Strict cookie).
- 8 wrong passwords from one address lock that address for 10 minutes.
- Saves must come from the editor page itself (same-origin check), as JSON.
- The server still listens on 127.0.0.1 only: the tunnel is the only way in.

## Saving and pushing

Saves are commits on the branch chosen in the editor, on the machine running the server. "Subir"
pushes the branch to GitHub, which needs that machine to have push access (an SSH key registered
on GitHub). Without it, commits stay on that machine until someone pushes them.

## Running it on an always-on machine (container)

`_dev/docker/` runs the editor in a Docker container so that a break-in, should one ever happen,
lands in a disposable box instead of a user account: no host folders mounted, read-only root,
all capabilities dropped, no privilege escalation, memory and process limits, its own unprivileged
user. The box holds only a clone of the repo and two secrets passed in read-only at run time:

- `~/.config/boda-editor/password`: the editor password.
- `~/.config/boda-editor/deploy_key`: the private half of a **GitHub deploy key** for this one
  repo with write access (Settings → Deploy keys → Add, tick "Allow write access"). It can push
  this repo and nothing else, so even a compromised box cannot touch other repos or the account.

```bash
bash _dev/docker/run.sh          # build + start (restarts on reboot: --restart unless-stopped)
bash _dev/docker/run.sh link     # the current public link
bash _dev/docker/run.sh logs     # follow the log
bash _dev/docker/run.sh stop
```

The container clones `editor` from GitHub on first start and pulls on every restart, so updating
the editor code is: push to `editor`, then `run.sh` again. The link changes on every restart.
Check first that the machine's owner (lab, institution) allows a public tunnel.
