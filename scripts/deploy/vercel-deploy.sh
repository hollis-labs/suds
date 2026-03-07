#!/usr/bin/env bash
# Deploy to Vercel
# Usage: vercel-deploy.sh [--prod]
set -euo pipefail
cd "$(dirname "$0")/../.."

PROD_FLAG=""
if [ "${1:-}" = "--prod" ]; then
  PROD_FLAG="--prod"
  echo "==> Deploying to PRODUCTION..."
else
  echo "==> Deploying preview..."
fi

vercel deploy $PROD_FLAG --yes
echo "==> Deploy complete."
