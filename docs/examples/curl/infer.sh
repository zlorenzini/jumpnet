#!/usr/bin/env bash
# examples/curl/infer.sh — classify an image
# Usage:  ./infer.sh <image_path> [bundle_id]

JUMPNET="${JUMPNET_URL:-http://localhost:4080}"
IMAGE="${1:?Usage: ./infer.sh <image_path> [bundle_id]}"
BUNDLE="${2:-}"

if [ -n "$BUNDLE" ]; then
  curl -s -X POST "$JUMPNET/infer" \
    -F "image=@${IMAGE}" \
    -F "bundleId=${BUNDLE}" | python3 -m json.tool 2>/dev/null || true
else
  curl -s -X POST "$JUMPNET/infer" \
    -F "image=@${IMAGE}" | python3 -m json.tool 2>/dev/null || true
fi
