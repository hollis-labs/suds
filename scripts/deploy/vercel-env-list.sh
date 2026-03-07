#!/usr/bin/env bash
# List Vercel environment variables
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "==> Vercel Environment Variables:"
vercel env ls
