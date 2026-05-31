# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace=apps/web --include-workspace-root

COPY apps/web/ ./apps/web/
COPY tsconfig.base.json ./

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace=apps/web

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S spendwise && adduser -S spendwise -G spendwise

# Standalone output bundles only what's needed
COPY --from=builder --chown=spendwise:spendwise /app/apps/web/.next/standalone ./
COPY --from=builder --chown=spendwise:spendwise /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=spendwise:spendwise /app/apps/web/public ./apps/web/public

USER spendwise

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
