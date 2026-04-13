# ─────────────────────────────────────────────────────────────
# SovereignSelf Agent — Multi-stage Dockerfile
# Stage 1: Build TypeScript with pnpm
# Stage 2: Minimal production runtime
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Builder ──
FROM node:23-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/agent/package.json packages/agent/tsconfig.json ./packages/agent/
COPY packages/api/package.json packages/api/tsconfig.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY packages/agent/src ./packages/agent/src
COPY packages/api/src ./packages/api/src

# Build TypeScript
RUN cd packages/agent && pnpm build || true
RUN cd packages/api && pnpm build || true

# ── Stage 2: Production Runtime ──
FROM node:23-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace config
COPY package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/agent/package.json packages/agent/tsconfig.json ./packages/agent/
COPY packages/api/package.json packages/api/tsconfig.json ./packages/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod || pnpm install --prod

# Copy built files from builder
COPY --from=builder /app/packages/agent/dist ./packages/agent/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Copy source files (needed for tsx in case dist doesn't exist)
COPY packages/agent/src ./packages/agent/src
COPY packages/api/src ./packages/api/src

# Don't run as root
USER node

EXPOSE 3001 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "packages/agent/dist/index.js"]
