#!/bin/sh
echo "[ANTS] boot start"
echo "[ANTS] PORT=${PORT:-8080}"

echo "[ANTS] syncing database schema..."
npx prisma db push --skip-generate || echo "[ANTS] db push warning (continuing)"

echo "[ANTS] seeding baseline data..."
node prisma/seed.js || echo "[ANTS] seed skipped/failed (non-fatal)"

PORT_VALUE="${PORT:-8080}"
echo "[ANTS] starting Next.js on 0.0.0.0:${PORT_VALUE}"
exec npx next start -H 0.0.0.0 -p "${PORT_VALUE}"
