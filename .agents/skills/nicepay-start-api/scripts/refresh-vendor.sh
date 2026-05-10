#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VER="0.0.10"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT
cd "$TMP"
npm pack "@nicepay/start-api-mcp@${VER}" --silent
tar -xzf "nicepay-start-api-mcp-${VER}.tgz"
rm -rf "$ROOT/vendor/nicepay-start-api-mcp"
mv package "$ROOT/vendor/nicepay-start-api-mcp"
(cd "$ROOT/vendor/nicepay-start-api-mcp" && npm install --omit=dev)
echo "OK: $ROOT/vendor/nicepay-start-api-mcp (re-run from repo root: scripts/refresh-vendor.sh)"
