#!/usr/bin/env bash
# Typecheck the project
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "==> Running TypeScript type check..."
npx tsc --noEmit
echo "==> Type check passed."
