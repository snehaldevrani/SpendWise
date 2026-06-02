# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/
COPY tsconfig.base.json ./

# Install ALL deps (including devDeps needed for tsc)
RUN npm ci --workspace=apps/api --include-workspace-root

# Copy full source
COPY apps/api/ ./apps/api/

# Generate Prisma client, then compile
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# OpenSSL required by Prisma's query/schema engine binaries on Alpine
RUN apk add --no-cache openssl

# Install only production deps
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=apps/api --include-workspace-root --omit=dev && npm cache clean --force

# Copy compiled output and Prisma artefacts from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/api/prisma ./apps/api/prisma

# Non-root user for security
RUN addgroup -S spendwise && adduser -S spendwise -G spendwise && \
    chown -R spendwise:spendwise /app/node_modules/@prisma /app/node_modules/.prisma /app/node_modules/prisma /app/apps
USER spendwise

EXPOSE 3001

# Run migrations then start the server. Using npx prisma so the CLI doesn't
# need to be a runtime dep — it resolves from the installed prisma package.
CMD ["sh", "-c", "node apps/api/node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/main"]
