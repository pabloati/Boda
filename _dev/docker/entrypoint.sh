#!/usr/bin/env bash
# Runs inside the container: clone or update the repo with the deploy key, start the editor in
# shared mode and the tunnel, and write the public link to /home/boda/link.txt.
set -euo pipefail
cd /home/boda
mkdir -p .ssh && chmod 700 .ssh
if [ -z "${BODA_DEPLOY_KEY_B64:-}" ] || [ -z "${BODA_EDITOR_PASSWORD:-}" ]; then echo "Faltan BODA_DEPLOY_KEY_B64 o BODA_EDITOR_PASSWORD"; exit 1; fi
echo "$BODA_DEPLOY_KEY_B64" | base64 -d > .ssh/id_ed25519 && chmod 600 .ssh/id_ed25519
unset BODA_DEPLOY_KEY_B64
ssh-keyscan -t ed25519 github.com >> .ssh/known_hosts 2>/dev/null
export GIT_SSH_COMMAND="ssh -i /home/boda/.ssh/id_ed25519 -o IdentitiesOnly=yes"
if [ ! -d repo/.git ]; then
  git clone -q --branch "$BODA_BRANCH" "$BODA_REPO" repo
fi
cd repo
git config user.name pabloati
git config user.email pabloatienzalo@gmail.com
git fetch -q origin && git checkout -q "$BODA_BRANCH" && git pull -q --ff-only || true
rm -f /home/boda/link.txt    # the old tunnel's address is dead: never offer it
BODA_PUBLIC_LINK_FILE=/home/boda/link.txt python3 _dev/serve.py "$BODA_PORT" &
SRV=$!
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$BODA_PORT" 2>&1 | while read -r line; do
  echo "$line"
  u=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' <<<"$line" || true)
  [ -n "$u" ] && echo "$u/_dev/flores.html" > /home/boda/link.txt && echo "LINK: $u/_dev/flores.html"
done &
wait $SRV
