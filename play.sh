#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"
PORT="${OATHBOUND_PORT:-8765}"
URL="http://127.0.0.1:${PORT}/"

if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  xdg-open "$URL" >/dev/null 2>&1 || true
  echo "Oathbound is already serving at $URL"
  exit 0
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/oathbound-http.log 2>&1 &
echo $! >/tmp/oathbound-http.pid
disown
sleep 0.35
xdg-open "$URL" >/dev/null 2>&1 || true
echo "Oathbound — Last Vigil"
echo "Open $URL in your browser if it did not launch."
echo "Stop the server with: kill \$(cat /tmp/oathbound-http.pid)"
