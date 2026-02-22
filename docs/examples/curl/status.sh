#!/usr/bin/env bash
# examples/curl/status.sh — check JumpNet and upstream health
JUMPNET="${JUMPNET_URL:-http://localhost:4080}"
curl -s "$JUMPNET/status" | python3 -m json.tool 2>/dev/null || curl -s "$JUMPNET/status"
