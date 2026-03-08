#!/usr/bin/env bash
# Run Next.js dev server against local test database.
# Temporarily moves .env.local out of the way so Next.js doesn't load production credentials.

set -e

ENV_LOCAL=".env.local"
ENV_BACKUP=".env.local.bak"

cleanup() {
  if [ -f "$ENV_BACKUP" ]; then
    mv "$ENV_BACKUP" "$ENV_LOCAL"
    echo ""
    echo "Restored .env.local"
  fi
}

trap cleanup EXIT INT TERM

if [ -f "$ENV_LOCAL" ]; then
  mv "$ENV_LOCAL" "$ENV_BACKUP"
  echo "Moved .env.local aside (will restore on exit)"
fi

dotenv -e .env.test -- next dev --turbopack
