#!/usr/bin/env bash
# Desktop launcher: serve Oathbound on loopback and open it as a Chromium app.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
PORT="${OATHBOUND_PORT:-8765}"
APP_URL="http://127.0.0.1:${PORT}/"
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/oathbound"
LOG_FILE="$LOG_DIR/server.log"
PID_FILE="$LOG_DIR/server.pid"

mkdir -p "$LOG_DIR"
cd "$APP_DIR"
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

log() { echo "$(date -Iseconds) $*" >>"$LOG_FILE"; }
notify() { command -v notify-send >/dev/null 2>&1 && notify-send "Oathbound" "$1" || true; }

is_up() {
  curl -fsS --max-time 1 "$APP_URL" >/dev/null 2>&1
}

open_game() {
  if command -v omarchy-launch-webapp >/dev/null 2>&1; then
    exec omarchy-launch-webapp "$APP_URL"
  elif command -v chromium >/dev/null 2>&1; then
    exec chromium --app="$APP_URL" --class=oathbound
  elif command -v xdg-open >/dev/null 2>&1; then
    exec xdg-open "$APP_URL"
  else
    notify "Open $APP_URL"
    exit 1
  fi
}

start_server() {
  if [ -f "$PID_FILE" ]; then
    old="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then
      if is_up; then
        return 0
      fi
      kill "$old" 2>/dev/null || true
      sleep 0.2
    fi
    rm -f "$PID_FILE"
  fi

  log "Starting python http.server on :$PORT"
  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
}

wait_ready() {
  local i=0
  while [ $i -lt 40 ]; do
    if is_up; then return 0; fi
    i=$((i + 1))
    sleep 0.15
  done
  return 1
}

log "=== Launch ==="

if ! is_up; then
  start_server
  if ! wait_ready; then
    log "Start failed"
    tail -20 "$LOG_FILE" >>"$LOG_FILE" || true
    notify "Failed to start — see $LOG_FILE"
    exit 1
  fi
  log "Ready at $APP_URL"
fi

open_game
