# syntax=docker/dockerfile:1.7
#
# ReviewHub — all-in-one production image (API + built SPA served from same process).
#
# Solo-founder / Railway-friendly topology: one container, one port, one URL.
# The Express server serves /api/* and falls back to the built React SPA for
# everything else (SPA routes like /dashboard, /settings, /reset-password hydrate
# client-side). No reverse proxy needed, no cross-service networking.
#
# If you want the two-service split (separate nginx-fronted SPA + API), use
# server/Dockerfile + client/Dockerfile + docker-compose.yml instead.
#
# Build from repo root:
#   docker build -t reviewhub .
# Run:
#   docker run --init --env-file .env -p 3001:3001 -v rh-data:/app/data reviewhub

# ─── Stage 1: build the client SPA ────────────────────────────────────
FROM node:20-bookworm-slim AS client-builder
WORKDIR /build
COPY client/package.json client/package-lock.json* ./
# Using npm install (not ci) because the lockfile has cross-platform optional
# binary metadata that strict ci doesn't tolerate. install handles it cleanly.
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build
# Output: /build/dist

# ─── Stage 2: build the server with native deps ───────────────────────
FROM node:20-bookworm-slim AS server-builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=optional
COPY server/src ./src
COPY server/scripts ./scripts
RUN npm prune --omit=dev

# ─── Stage 3: slim runtime image ──────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    SERVE_CLIENT=1 \
    CLIENT_DIST_DIR=/app/client-dist

RUN chown -R node:node /app

# Server
COPY --from=server-builder --chown=node:node /app/package.json ./
COPY --from=server-builder --chown=node:node /app/node_modules ./node_modules
COPY --from=server-builder --chown=node:node /app/src ./src
COPY --from=server-builder --chown=node:node /app/scripts ./scripts

# Built client SPA — served by Express via SERVE_CLIENT=1
COPY --from=client-builder --chown=node:node /build/dist ./client-dist

# SQLite DB + backup mountpoints — Railway mounts volumes here (configured in Railway UI, not Dockerfile)
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/index.js"]
