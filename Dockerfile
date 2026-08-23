# syntax=docker/dockerfile:1

# ---- build stage -----------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# Prisma's query engine needs openssl at both build and run time.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

# `prisma` is a runtime dependency in this project, so generate here too —
# the client is platform-specific and must match this image.
COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# main.ts reads process.env.PORT and falls back to 3000.
EXPOSE 3000

# Run unprivileged.
USER node

CMD ["node", "dist/main"]
