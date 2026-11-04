#!/usr/bin/env bash
# Capture the social preview image (Open Graph / Twitter card) from the built site.
# Usage: scripts/capture_preview.sh <site-dir> <out.png>
set -euo pipefail

SITE_DIR=${1:?site dir}
OUT=${2:?output png}
PORT=${PORT:-8765}
CHROME=${CHROME:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}
if [ -z "$CHROME" ]; then
  echo "capture_preview: no Chrome/Chromium found (set CHROME)" >&2
  exit 1
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SITE_DIR" >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null && break
  sleep 0.1
done

PROFILE=$(mktemp -d)
"$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --user-data-dir="$PROFILE" --window-size=600,315 --force-device-scale-factor=2 \
  --virtual-time-budget=5000 --screenshot="$OUT" \
  "http://127.0.0.1:$PORT/?capture" >/dev/null 2>&1
rm -rf "$PROFILE"

test -s "$OUT"
echo "capture_preview: wrote $OUT"
