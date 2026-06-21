# syntax=docker/dockerfile:1
# Multi-stage build for the HRMS backend (Node 20 + Prisma).

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Strong secrets (JWT_SECRET, FIELD_ENCRYPTION_KEY) MUST be injected at runtime;
# the app refuses to boot in production without them (see src/config/secrets.js).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
EXPOSE 5000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "src/index.js"]
