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

"Ver en mi móvil" needs the tunnel's address even when the editor is opened on that machine
itself (localhost): `compartir.sh` and the container write it to the file named by
`BODA_PUBLIC_LINK_FILE` once the tunnel is up, and the server hands it to the editor. Each server
offers only its own tunnel, since each has its own copy of the repo and its own saves.

## Running it on an always-on machine (container)

`_dev/docker/` runs the editor in a Docker container so that a break-in, should one ever happen,
lands in a disposable box instead of a user account: no host folders mounted, read-only root,
all capabilities dropped, memory and process limits, its own unprivileged
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

### The chat with Claude in the container (optional)

The image carries Claude Code, but the chat (`docs/editor.md`) only turns on when the box gets a
third secret, a Claude Code token:

```bash
claude setup-token                      # in your own terminal; it opens the browser and prints a token
install -m 600 /dev/null ~/.config/boda-editor/claude_token
nano ~/.config/boda-editor/claude_token # paste the token, save
bash _dev/docker/run.sh                 # says "Chat con Claude activado hasta el …"
```

- **What the token can do.** Only run Claude on Pablo's subscription ("can only make model
  requests", Claude Code's authentication docs). It gives no access to files, GitHub or the account.
- **A month at a time.** The box uses the token for 30 days counted from the day the file was
  written (`BODA_CLAUDE_DAYS` changes it). After that the server forgets it and hides the chat
  button, and `run.sh` stops passing it. The panel warns during the last week. To go on: a new
  token in the same file, then `run.sh`.
- **That limit is the editor's, not the token's.** `claude setup-token` always makes a one-year
  token and has no option for a shorter one, and the docs describe no way to revoke a single
  token. So a copy stolen from the box would keep working after the month. If a break-in is ever
  suspected, stop the container and ask Anthropic support how to invalidate it. A stricter set-up
  (an API key with a spending cap, which can be deleted at any time) is possible but not built.
- **The model.** The chat answers with one model for everybody (`opus` until changed). To be able
  to change it from the panel, give the box a second password that only Pablo knows:
  `~/.config/boda-editor/admin_password` (mode 600), then `run.sh`. Without that file nobody can
  change the model from the editor. `compartir.sh` reads the same file.
- **Where it lives.** In the container's environment, like the other two secrets. Claude's own
  process gets it (it needs it) but has no shell and cannot read outside the branch folder. With
  the chat on, the box gets 2 GB of memory instead of 512 MB.

Snap-installed Docker (as on clab) has three quirks the scripts already work around: it cannot
read files under `~/.config` (so secrets go in with `-e`, not mounts or `--env-file`),
`--security-opt no-new-privileges` makes every exec fail, and a named volume seeded from the
image shadows later changes to anything inside it (so the entrypoint lives in `/usr/local/bin`).

The container clones `editor` from GitHub on first start and pulls on every restart, so updating
the editor code is: push to `editor`, then `run.sh` again. The link changes on every restart.
Check first that the machine's owner (lab, institution) allows a public tunnel.
