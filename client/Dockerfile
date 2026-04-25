# syntax=docker/dockerfile:1.7
# ReviewHub client — static build served by nginx.
#
# Multi-stage: vite builds the SPA into /app/dist, then nginx serves it with
# appropriate headers. We do NOT proxy /api here — the deployment layer
# (reverse-proxy / load balancer / cloudflare) is responsible for routing
# /api → the API container and everything else → this container.
#
# Build:  docker build -t reviewhub-client ./client
# Run:    docker run -p 8080:80 reviewhub-client

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Remove dev-only files that npm ci may have pulled in via scripts
RUN npm run build

# ─── Runtime: nginx alpine ───────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# Healthcheck hits the SPA index — if nginx is up and serving, we're good.
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
