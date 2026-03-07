#!/usr/bin/env bash
# Generate a secure random secret
set -euo pipefail

SECRET=$(openssl rand -base64 32)
echo "$SECRET"
