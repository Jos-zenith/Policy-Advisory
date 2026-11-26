# Famsurance: Next.js standalone build with SQLite on a persistent volume at /data.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 builds a native module
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATABASE_PATH=/data/app.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Generated evidence for /judges/qa and the seed sources
COPY --from=build /app/src/qa ./src/qa
COPY --from=build /app/src/server/schema.sql ./src/server/schema.sql
# Seed script runtime (tsx) so the container can seed its own volume on first boot
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000
# Seed is idempotent: it only inserts advisors/slots when the tables are empty.
CMD ["sh", "-c", "npx tsx src/server/seed.ts && node server.js"]
