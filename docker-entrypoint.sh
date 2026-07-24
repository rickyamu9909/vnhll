#!/bin/sh
set -e

echo "[ynhll] syncing database schema..."
npx prisma db push --skip-generate

echo "[ynhll] seeding baseline data..."
if node prisma/seed.js; then
  echo "[ynhll] seed done"
else
  echo "[ynhll] seed skipped/failed (non-fatal), continuing..."
fi

echo "[ynhll] starting Next.js on 0.0.0.0:${PORT:-3000}"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
