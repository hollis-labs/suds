#!/usr/bin/env bash
# Lint the project (if eslint is configured)
set -euo pipefail
cd "$(dirname "$0")/../.."

if [ -f ".eslintrc.json" ] || [ -f "eslint.config.mjs" ] || [ -f "eslint.config.js" ]; then
  echo "==> Running ESLint..."
  npx next lint
  echo "==> Lint passed."
else
  echo "==> No ESLint config found, skipping."
fi
