#!/usr/bin/env bash
# Push database schema to target DB
# Usage: db-push.sh [database_url]
# If database_url is provided, it overrides DATABASE_URL env var
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -n "${1:-}" ]; then
  export DATABASE_URL="$1"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set and no argument provided."
  exit 1
fi

echo "==> Pushing schema to database..."
npx drizzle-kit push
echo "==> Schema push complete."
