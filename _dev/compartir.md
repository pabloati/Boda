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

## Running it on an always-on machine

Clone the repo, check out the `editor` branch, add a GitHub deploy key with write access (or the
user's key) so pushes work, then keep `bash _dev/compartir.sh` running (tmux, or a systemd user
service). Check first that the machine's owner (lab, institution) allows a public tunnel.
