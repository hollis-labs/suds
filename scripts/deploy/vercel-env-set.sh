#!/usr/bin/env bash
# Set a Vercel environment variable across all environments
# Usage: vercel-env-set.sh <key> <value>
set -euo pipefail
cd "$(dirname "$0")/../.."

KEY="${1:?Usage: vercel-env-set.sh <key> <value>}"
VALUE="${2:?Usage: vercel-env-set.sh <key> <value>}"

echo "==> Setting $KEY across production, preview, development..."

# Remove existing values (ignore errors if not set)
for env in production preview development; do
  vercel env rm "$KEY" "$env" --yes 2>/dev/null || true
done

# Add new values
vercel env add "$KEY" production --value "$VALUE" --yes 2>&1 | grep -E "Added|Error"
vercel env add "$KEY" preview '' --value "$VALUE" --yes 2>&1 | grep -E "Added|Error"
vercel env add "$KEY" development --value "$VALUE" --yes 2>&1 | grep -E "Added|Error"

echo "==> $KEY set successfully."
