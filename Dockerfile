# Container image for hosting the web/mobile version.
#
# The database is SQLite on disk, so this image REQUIRES a persistent volume
# mounted at /data. On a host with ephemeral disk (most serverless platforms)
# every deploy would silently start from an empty database — see the hosting
# section of the README before deploying.

FROM node:22-slim AS builder
WORKDIR /app

# openssl is required by Prisma's query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# DATABASE_URL is only needed so the build can load the Prisma schema; the
# real database path is supplied at runtime.
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate && npm run build


FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 1001 appuser

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL="file:/data/pocket-money.db"

# Standalone output: server + only the traced dependencies it needs.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Schema and migration CLI, so the entrypoint can create the database on a
# fresh volume.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data && chown appuser /data

VOLUME ["/data"]
USER appuser
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
