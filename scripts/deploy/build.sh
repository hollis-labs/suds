#!/usr/bin/env bash
# Build the Next.js project
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "==> Building Next.js project..."
pnpm build
echo "==> Build complete."
