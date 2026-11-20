#!/usr/bin/env bash
# Builds and (re)starts the editor container on this machine. Run from anywhere:
#   bash _dev/docker/run.sh            # start or restart
#   bash _dev/docker/run.sh link       # print the current public link
#   bash _dev/docker/run.sh stop
# Secrets (never in git, never in the image):
#   ~/.config/boda-editor/password     the editor password
#   ~/.config/boda-editor/deploy_key   private half of a GitHub deploy key with write access to the repo
#   ~/.config/boda-editor/admin_password optional: a second password, only Pablo's, asked to change the
#                                      model the chat uses; without it nobody can change it from the editor
#   ~/.config/boda-editor/claude_token optional: a Claude Code token (`claude setup-token`), turns on the
#                                      editor's chat with Claude; without it the box runs as before.
#                                      Used for 30 days from the day the file was written: after that the
#                                      chat turns itself off and this script stops passing the token
#                                      (the token itself lives longer: revoke it, see _dev/compartir.md)
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
CFG=$HOME/.config/boda-editor
NAME=boda-editor
case "${1:-start}" in
  link) docker exec $NAME cat /home/boda/link.txt 2>/dev/null || { echo "Sin enlace todavía:"; docker logs --tail 5 $NAME; } ;;
  stop) docker rm -f $NAME ;;
  logs) docker logs --tail 40 -f $NAME ;;
  start)
    [ -s "$CFG/password" ] || { echo "Falta $CFG/password"; exit 1; }
    [ -s "$CFG/deploy_key" ] || { echo "Falta $CFG/deploy_key"; exit 1; }
    docker build -q -t $NAME "$HERE"
    docker rm -f $NAME 2>/dev/null || true
    # no host mounts at all; the repo lives in a named volume
    # the secrets go in as environment: snap Docker cannot read files under ~/.config, so this
    # shell reads them and passes the values (they live only in the daemon's container config)
    # with the chat on, Claude Code runs inside the box too: it needs more memory and processes
    CHAT=(--memory 512m --pids-limit 256)
    if [ -s "$CFG/claude_token" ]; then
      UNTIL=$(( $(stat -c %Y "$CFG/claude_token") + ${BODA_CLAUDE_DAYS:-30} * 86400 ))
      if [ "$(date +%s)" -ge "$UNTIL" ]; then
        echo "El token de Claude ha caducado (más de ${BODA_CLAUDE_DAYS:-30} días): el editor arranca sin chat."
        echo "Para volver a tenerlo: revoca el viejo, crea otro con 'claude setup-token' y guárdalo en $CFG/claude_token"
      else
        export CLAUDE_CODE_OAUTH_TOKEN BODA_CLAUDE_UNTIL=$UNTIL
        CLAUDE_CODE_OAUTH_TOKEN=$(tr -d ' \n\r' < "$CFG/claude_token")
        CHAT=(--memory 2g --pids-limit 1024 -e CLAUDE_CODE_OAUTH_TOKEN -e BODA_CLAUDE_UNTIL)
        echo "Chat con Claude activado hasta el $(date -d @$UNTIL +%d/%m/%Y)."
      fi
    fi
    # optional: Pablo's own password to change the chat's model ($CFG/admin_password)
    if [ -s "$CFG/admin_password" ]; then
      export BODA_ADMIN_PASSWORD; BODA_ADMIN_PASSWORD=$(cat "$CFG/admin_password"); CHAT+=(-e BODA_ADMIN_PASSWORD)
    fi
    BODA_EDITOR_PASSWORD=$(cat "$CFG/password") BODA_DEPLOY_KEY_B64=$(base64 -w0 "$CFG/deploy_key") \
    docker run -d --name $NAME --restart unless-stopped \
      --read-only --tmpfs /tmp --tmpfs /run:mode=1777 \
      --cap-drop ALL \
      "${CHAT[@]}" \
      -e BODA_EDITOR_PASSWORD -e BODA_DEPLOY_KEY_B64 \
      -v boda-editor-home:/home/boda \
      $NAME >/dev/null
    echo "Arrancando… (el enlace tarda unos 20 s)"; sleep 22
    docker exec $NAME cat /home/boda/link.txt 2>/dev/null || docker logs --tail 8 $NAME ;;
  *) echo "uso: run.sh [start|link|stop|logs]"; exit 1 ;;
esac
