#!/usr/bin/env bash
# Set a Vercel environment variable
# Usage: vercel-env-set.sh <key> <value> [environment]
# Environment: production, preview, development (default: all)
set -euo pipefail
cd "$(dirname "$0")/../.."

KEY="${1:?Usage: vercel-env-set.sh <key> <value> [environment]}"
VALUE="${2:?Usage: vercel-env-set.sh <key> <value> [environment]}"
ENV="${3:-production preview development}"

echo "==> Setting $KEY for environments: $ENV"

# Remove existing value first (ignore errors if it doesn't exist)
for e in $ENV; do
  echo "$VALUE" | vercel env rm "$KEY" "$e" --yes 2>/dev/null || true
done

# Add new value
for e in $ENV; do
  echo "$VALUE" | vercel env add "$KEY" "$e"
done

echo "==> $KEY set successfully."
