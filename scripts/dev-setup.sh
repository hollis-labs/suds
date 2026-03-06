#!/usr/bin/env bash
set -e

echo "=== SUDS v2 Dev Setup ==="

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker not found. Install Docker or OrbStack first."
  exit 1
fi

# Start PostgreSQL
echo "Starting PostgreSQL..."
docker compose -f docker-compose.dev.yml up -d postgres
echo "Waiting for PostgreSQL..."
until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U suds -d suds_v2 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL is ready."

# Check .env.local
if [ ! -f .env.local ]; then
  echo "Creating .env.local from template..."
  cp .env.example .env.local
  echo "NOTE: Update .env.local with real OAuth credentials for login to work."
fi

# Push schema
echo "Pushing database schema..."
pnpm db:push

# Seed invite codes
echo "Seeding invite codes..."
pnpm db:seed 2>/dev/null || echo "Seed script may need DATABASE_URL — skipping."

echo ""
echo "=== Setup Complete ==="
echo "  Database: postgresql://suds:suds_dev_password@localhost:5432/suds_v2"
echo "  Run 'pnpm dev' to start the app at http://localhost:3000"
echo ""
