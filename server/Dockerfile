# syntax=docker/dockerfile:1.7
# ReviewHub API — production image.
#
# Multi-stage so the runtime image doesn't carry build tools, native compile
# output, or node_modules caches:
#   stage 1 (builder): install all deps (including native better-sqlite3 which
#     needs python + a toolchain), then prune dev deps
#   stage 2 (runtime): copy the pruned node_modules + src + scripts, run as a
#     non-root user, set a tini-free init via --init flag at docker run time
#
# Build:   docker build -t reviewhub-api ./server
# Run:     docker run --init --env-file .env -p 3001:3001 -v rh-data:/app/data reviewhub-api

FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Native deps for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Copy manifests first so `npm ci` can be cached independently of source.
COPY package.json package-lock.json* ./
RUN npm ci --omit=optional

# Copy the rest of the app and prune to production deps only. Doing this
# AFTER `npm ci` keeps the devDependency install available for any build
# step that might need it later (TypeScript, esbuild, etc.) without having
# to reinstall.
COPY src ./src
COPY scripts ./scripts
RUN npm prune --omit=dev

# ─── Runtime image ────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001

# Tini is nice-to-have but we document --init on the run side to keep the
# image small. No extra packages in the runtime layer.

# Non-root user — Node images ship `node:node` (uid 1000) by default, reuse it
RUN chown -R node:node /app

# Pull the pruned tree from the builder
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/scripts ./scripts

# SQLite DB + backups live on a mounted volume so they survive container
# replacements. Pre-create so the app doesn't need permission to mkdir at
# runtime under the non-root user.
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups

USER node
EXPOSE 3001

# Lightweight liveness probe — the /api/health endpoint already gates on
# DB + SMTP reachability and returns 503 if any critical dep is down.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/index.js"]
