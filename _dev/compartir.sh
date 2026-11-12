#!/usr/bin/env bash
# Shares the site editor through a free Cloudflare quick tunnel (no account), password protected.
# Use:  bash _dev/compartir.sh [port]      (default 8090)   — Ctrl+C stops both.
# Details and first-time setup: _dev/compartir.md
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${1:-8090}
PWF=${BODA_EDITOR_PASSWORD_FILE:-$HOME/.config/boda-editor/password}
if [ ! -s "$PWF" ]; then
  echo "Falta la contraseña. Créala una vez con:"
  echo "  mkdir -p ~/.config/boda-editor && read -rsp 'Contraseña: ' P && echo \"\$P\" > $PWF && chmod 600 $PWF"
  exit 1
fi
CF=$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")
if [ ! -x "$CF" ]; then
  echo "Descargando cloudflared (Cloudflare, gratis) en ~/.local/bin ..."
  mkdir -p "$HOME/.local/bin"
  curl -fsSL -o "$CF" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x "$CF"
fi
LOG=$(mktemp)
LINKF=$(mktemp)    # the tunnel's address, for the editor's "Ver en mi móvil" (serve.py reads it)
BODA_EDITOR_PASSWORD_FILE="$PWF" BODA_PUBLIC_LINK_FILE="$LINKF" python3 _dev/serve.py "$PORT" & SRV=$!
"$CF" tunnel --no-autoupdate --url "http://localhost:$PORT" >"$LOG" 2>&1 & TUN=$!
trap 'kill $SRV $TUN 2>/dev/null; rm -f "$LOG" "$LINKF"' EXIT INT TERM
for _ in $(seq 40); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "${URL:-}" ]; then echo "No se pudo abrir el túnel:"; tail -5 "$LOG"; exit 1; fi
echo "$URL" > "$LINKF"
echo
echo "  Enlace para compartir:  $URL/_dev/flores.html"
echo "  (pide la contraseña; el enlace cambia cada vez que se arranca)"
echo
wait $SRV
