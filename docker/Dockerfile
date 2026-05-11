FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm run build

FROM base AS runner
RUN addgroup --system --gid 1001 paracosm && \
    adduser --system --uid 1001 paracosm
USER paracosm

COPY --from=builder --chown=paracosm:paracosm /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=paracosm:paracosm /app/package.json ./
COPY --from=builder --chown=paracosm:paracosm /app/pnpm-workspace.yaml ./
COPY --from=deps --chown=paracosm:paracosm /app/node_modules ./node_modules
COPY --from=deps --chown=paracosm:paracosm /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder --chown=paracosm:paracosm /app/packages/shared/package.json ./packages/shared/package.json

EXPOSE 7529

ENV NODE_ENV=production
ENV PORT=7529

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7529/health || exit 1

CMD ["node", "--enable-source-maps", "packages/shared/dist/index.js"]
