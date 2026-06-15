#!/usr/bin/env sh
# Start the dashboard from the publish bundle on Linux / macOS.
#   chmod +x deploy/linux/start.sh && ./deploy/linux/start.sh
# Loads .env from the bundle root if present. Requires Node 22+.
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

if [ -f "$ROOT/.env" ]; then
  set -a
  . "$ROOT/.env"
  set +a
fi

exec node server.js
