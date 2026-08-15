#!/bin/sh
set -e

# Bring the database on the mounted volume up to the current schema. This is
# additive: `db push` creates missing tables/columns, and without
# --accept-data-loss it refuses rather than performing a destructive change,
# so it is safe to run on every start against a database holding real data.
echo "Applying database schema to ${DATABASE_URL}..."
node node_modules/prisma/build/index.js db push --skip-generate --schema prisma/schema.prisma

exec "$@"
