# syntax=docker/dockerfile:1
# Multi-stage build for the HRMS backend (Node 20 + Prisma).

FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
COPY scripts ./scripts
# Production runs on PostgreSQL — generate the client from the PG schema so it
# matches the runtime DATABASE_URL (a SQLite-generated client would fail there).
RUN node scripts/make-postgres-schema.js \
 && npx prisma generate --schema=prisma/schema.postgres.prisma
COPY . .

FROM node:20 AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Strong secrets (JWT_SECRET, FIELD_ENCRYPTION_KEY) MUST be injected at runtime;
# the app refuses to boot in production without them (see src/config/secrets.js).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health/live', (r) => { if (r.statusCode !== 200) process.exit(1); }).on('error', () => process.exit(1));"
CMD ["node", "src/index.js"]
