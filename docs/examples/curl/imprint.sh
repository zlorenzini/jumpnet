#!/usr/bin/env bash
# examples/curl/imprint.sh — start a fine-tuning job
# Usage:  ./imprint.sh <dataset> [epochs] [lr]

JUMPNET="${JUMPNET_URL:-http://localhost:4080}"
DATASET="${1:?Usage: ./imprint.sh <dataset> [epochs] [lr]}"
EPOCHS="${2:-10}"
LR="${3:-0.001}"

curl -s -X POST "$JUMPNET/imprint" \
  -H "Content-Type: application/json" \
  -d "{\"dataset\":\"$DATASET\",\"epochs\":$EPOCHS,\"learningRate\":$LR}" \
  | python3 -m json.tool 2>/dev/null || true
