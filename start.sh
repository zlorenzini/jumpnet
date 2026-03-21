#!/usr/bin/env bash
# start.sh — Launch JumpNet (Node.js gateway + Python ML runtime)
#
# Usage:
#   ./start.sh          # start both servers
#   ./start.sh stop     # stop both servers
#
# Servers:
#   JumpNet gateway      http://localhost:4080  (Node.js / Express)
#   JumpSmartsRuntime    http://localhost:7312  (Python / FastAPI)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv/bin/python"
PID_DIR="$SCRIPT_DIR/.pids"
mkdir -p "$PID_DIR"

# ── Load environment overrides (.env) ─────────────────────────────────────────
# Place a .env file next to start.sh to configure this node without editing
# the script. Common keys: DEVICE_ID, DEVICE_ROLES, DATA_DIR, GPU_HELPER_URL,
# DX_COMPILE_URL, DXCOM_PYTHON, PORT.
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$SCRIPT_DIR/.env"; set +a
  echo "[jumpnet] Loaded config from $SCRIPT_DIR/.env"
fi

# ── Stop ──────────────────────────────────────────────────────────────────────
stop_servers() {
  echo "[jumpnet] Stopping services…"
  for what in jumpsmarts jumpnet; do
    pid_file="$PID_DIR/$what.pid"
    if [[ -f "$pid_file" ]]; then
      pid=$(cat "$pid_file")
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" && echo "  stopped $what (pid $pid)"
      fi
      rm -f "$pid_file"
    fi
  done
}

if [[ "${1}" == "stop" ]]; then
  stop_servers
  exit 0
fi

# ── Guard: already running ────────────────────────────────────────────────────
for what in jumpsmarts jumpnet; do
  pid_file="$PID_DIR/$what.pid"
  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "[jumpnet] $what is already running (pid $(cat "$pid_file")). Run './start.sh stop' first."
    exit 1
  fi
done

# ── JumpSmartsRuntime (port 7312) ─────────────────────────────────────────────
echo "[jumpnet] Starting JumpSmartsRuntime on port 7312…"
"$VENV" "$SCRIPT_DIR/server/ml/jumpsmarts.py" \
  >> "$SCRIPT_DIR/logs/jumpsmarts.log" 2>&1 &
echo $! > "$PID_DIR/jumpsmarts.pid"

# ── JumpNet gateway (port 4080) ───────────────────────────────────────────────
echo "[jumpnet] Starting JumpNet gateway on port 4080…"
mkdir -p "$SCRIPT_DIR/logs"
node "$SCRIPT_DIR/server/server.js" \
  >> "$SCRIPT_DIR/logs/jumpnet.log" 2>&1 &
echo $! > "$PID_DIR/jumpnet.pid"

# ── Wait for both to be ready ─────────────────────────────────────────────────
echo "[jumpnet] Waiting for services to start…"
for i in $(seq 1 20); do
  sleep 0.5
  js_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4080/status 2>/dev/null || true)
  py_ok=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:7312/status 2>/dev/null || true)
  if [[ "$js_ok" == "200" && "$py_ok" == "200" ]]; then
    echo ""
    echo "  ✓ JumpNet gateway      → http://localhost:4080"
    echo "  ✓ JumpSmartsRuntime    → http://localhost:7312"
    echo ""
    echo "  Open http://localhost:4080 in a browser to get started."
    exit 0
  fi
  printf "."
done

# Partial start — report what's up
echo ""
[[ "$js_ok" == "200" ]] && echo "  ✓ JumpNet gateway      → http://localhost:4080" \
                         || echo "  ✗ JumpNet gateway failed to start (check logs/jumpnet.log)"
[[ "$py_ok" == "200" ]] && echo "  ✓ JumpSmartsRuntime    → http://localhost:7312" \
                         || echo "  ✗ JumpSmartsRuntime failed to start (check logs/jumpsmarts.log)"
