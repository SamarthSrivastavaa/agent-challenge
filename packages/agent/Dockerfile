# ─────────────────────────────────────────────────────────────
# SovereignSelf — Production Dockerfile
# Uses Debian Slim (glibc) for native ML binary compatibility
# ─────────────────────────────────────────────────────────────

FROM node:23-slim

RUN corepack enable && corepack prepare pnpm@9 --activate

# Build tools for native modules + curl for healthcheck (using Debian's apt-get)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV LOG_LEVEL=info

# Copy workspace manifests + npmrc
COPY package.json pnpm-workspace.yaml* tsconfig.base.json .npmrc* ./
COPY packages/agent/package.json packages/agent/tsconfig.json ./packages/agent/
COPY packages/api/package.json packages/api/tsconfig.json ./packages/api/

# Run install. Since we are on glibc, pnpm will naturally pull the correct standard Linux binaries.
# NODE_ENV must NOT be "production" or pnpm skips devDependencies (tsx).
RUN NODE_ENV=development pnpm install

ENV NODE_ENV=production

# Copy source code
COPY packages/agent/src ./packages/agent/src
COPY packages/api/src ./packages/api/src

# Verify tsx is available
RUN ls node_modules/.bin/tsx && echo "tsx found at node_modules/.bin/tsx"

# Copy startup script
COPY packages/agent/start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3001 3002 3099

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -sf http://localhost:3001/health || exit 1

CMD ["bash", "./start.sh"]