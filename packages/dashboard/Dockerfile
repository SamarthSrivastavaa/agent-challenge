# ─────────────────────────────────────────────────────────────
# SovereignSelf Dashboard — Multi-stage Dockerfile
# Stage 1: Build Vite app with pnpm
# Stage 2: Serve via nginx with API/WS proxy
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Builder ──
FROM node:23-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace root files
COPY pnpm-workspace.yaml package.json ./
COPY packages/dashboard/package.json ./packages/dashboard/

# Install dependencies
RUN cd packages/dashboard && pnpm install || true

# Copy source + config
COPY packages/dashboard/ ./packages/dashboard/

# Build Vite app
RUN cd packages/dashboard && pnpm build

# ── Stage 2: nginx ──
FROM nginx:alpine AS runner

# Copy built static files
COPY --from=builder /app/packages/dashboard/dist /usr/share/nginx/html

# Copy nginx config with API/WS proxy rules
COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
