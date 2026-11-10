#!/usr/bin/env bash
# Builds and (re)starts the editor container on this machine. Run from anywhere:
#   bash _dev/docker/run.sh            # start or restart
#   bash _dev/docker/run.sh link       # print the current public link
#   bash _dev/docker/run.sh stop
# Secrets (never in git, never in the image):
#   ~/.config/boda-editor/password     the editor password
#   ~/.config/boda-editor/deploy_key   private half of a GitHub deploy key with write access to the repo
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
    # the secrets go in as environment (the files on the host belong to this user, the box runs as
    # another), read from a file so they never appear in the shell history or `ps`
    { echo "BODA_EDITOR_PASSWORD=$(cat "$CFG/password")"; echo "BODA_DEPLOY_KEY_B64=$(base64 -w0 "$CFG/deploy_key")"; } > "$CFG/env"
    chmod 600 "$CFG/env"
    docker run -d --name $NAME --restart unless-stopped \
      --read-only --tmpfs /tmp --tmpfs /run:mode=1777 \
      --cap-drop ALL \
      --memory 512m --pids-limit 256 \
      --env-file "$CFG/env" \
      -v boda-editor-home:/home/boda \
      $NAME >/dev/null
    rm -f "$CFG/env"
    echo "Arrancando… (el enlace tarda unos 20 s)"; sleep 22
    docker exec $NAME cat /home/boda/link.txt 2>/dev/null || docker logs --tail 8 $NAME ;;
  *) echo "uso: run.sh [start|link|stop|logs]"; exit 1 ;;
esac
