#!/bin/sh
echo "[ynhll] boot start"
echo "[ynhll] syncing database schema..."
npx prisma db push --skip-generate || echo "[ynhll] db push warning (continuing)"

echo "[ynhll] seeding baseline data..."
node prisma/seed.js || echo "[ynhll] seed skipped/failed (non-fatal)"

PORT_VALUE="${PORT:-3000}"
echo "[ynhll] starting Next.js on 0.0.0.0:${PORT_VALUE}"
exec npx next start -H 0.0.0.0 -p "${PORT_VALUE}"
