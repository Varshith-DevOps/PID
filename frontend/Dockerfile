# syntax=docker/dockerfile:1
# Multi-stage build for the HRMS frontend (Next.js 15).

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are inlined at build time; override per environment.
ARG NEXT_PUBLIC_API_URL=http://localhost:5000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Copy the whole built app (robust to optional next.config / public assets).
COPY --from=build /app ./
EXPOSE 3000
USER node
CMD ["npm", "start"]
