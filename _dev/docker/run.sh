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
    # no host mounts except the two secrets (read-only); the repo lives in a named volume
    docker run -d --name $NAME --restart unless-stopped \
      --read-only --tmpfs /tmp --tmpfs /run:mode=1777 \
      --cap-drop ALL \
      --memory 512m --pids-limit 256 \
      -v boda-editor-home:/home/boda \
      -v "$CFG/password:/run/secrets/editor_password:ro" \
      -v "$CFG/deploy_key:/run/secrets/deploy_key:ro" \
      $NAME >/dev/null
    echo "Arrancando… (el enlace tarda unos 20 s)"; sleep 22
    docker exec $NAME cat /home/boda/link.txt 2>/dev/null || docker logs --tail 8 $NAME ;;
  *) echo "uso: run.sh [start|link|stop|logs]"; exit 1 ;;
esac
