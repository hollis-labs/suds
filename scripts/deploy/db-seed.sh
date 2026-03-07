#!/usr/bin/env bash
# Seed the database (invite codes, etc.)
# Usage: db-seed.sh [database_url]
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -n "${1:-}" ]; then
  export DATABASE_URL="$1"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set and no argument provided."
  exit 1
fi

echo "==> Seeding database..."
pnpm db:seed
echo "==> Seed complete."
