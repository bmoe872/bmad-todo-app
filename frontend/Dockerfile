# syntax=docker/dockerfile:1
#
# Multi-stage frontend image (AD-10, NFR-Deploy):
#   builder → Node build: `npm ci` + `npm run build` produce the static dist/
#   runtime → nginx serves dist/ AND reverse-proxies /api/* to the backend, so
#             the browser sees a single origin (no CORS). Runs non-root.
#
# Node base pinned to 22 to match frontend/.nvmrc (22) and package.json
# engines.node ">=22 <23". nginx pinned to stable-alpine per the architecture Stack.

# ---- Stage 1: builder ----------------------------------------------------
# Base pinned by DIGEST (supply-chain hardening, Story 6.3 security pass) so the
# build is reproducible and immune to a mutated `node:22-slim` tag. Tag kept in
# the comment for readability. Digest resolved for node:22-slim (linux, 2026-07-23).
FROM node:22-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS builder

WORKDIR /build

# Install dependencies from the committed lockfile for a reproducible build.
# `npm ci` installs devDependencies too (typescript, vite, plugins) — needed
# because `npm run build` is `tsc --noEmit && vite build`.
COPY package.json package-lock.json ./
RUN npm ci

# Build the SPA. VITE_API_BASE_URL is intentionally NOT set: the API client
# (src/api/client.ts) defaults to the same-origin base "/api", which is exactly
# what nginx proxies in the single-origin stack (AD-10). Baking an absolute URL
# would break single-origin, so it stays unset.
COPY . .
RUN npm run build

# ---- Stage 2: runtime ----------------------------------------------------
# nginx base pinned by DIGEST (supply-chain hardening, Story 6.3). Tag kept in
# the comment. Digest resolved for nginx:stable-alpine (linux, 2026-07-23).
FROM nginx:stable-alpine@sha256:97d490c12ba55b4946b01546d1c3ed324e8d41ab1c9fcb2a616aa470620e5b46 AS runtime

# Single-origin server block replaces the stock conf.d/default.conf. The stock
# main nginx.conf already `include`s conf.d/*.conf inside http{}, so this is the
# least-surprise install point and keeps the default mime types / log format.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Built static assets.
COPY --from=builder /build/dist /usr/share/nginx/html

# Run non-root (NFR-Deploy / activity-spec). nginx listens on the unprivileged
# port 8080 (see nginx.conf), so no root is needed to bind. Give the `nginx`
# user ownership of the paths the master/workers write: cache/temp dirs and the
# pid file. (The `user` directive in the stock main config is ignored when not
# running as root — harmless.)
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

# Healthcheck: nginx GET / returns 200. The alpine image has no curl but busybox
# provides wget. Use 127.0.0.1 (not `localhost`) — in this image `localhost`
# resolves to IPv6 ::1 first, but nginx `listen 8080;` binds IPv4 only, so a
# localhost probe would be refused.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

# Default CMD from the base image (`nginx -g 'daemon off;'`) is correct for a
# foreground container.

# ---- Stage 3: dev (Story 5.3, dev profile only) --------------------------
# Runs the Vite dev server with HMR instead of the nginx static build. Installs
# LINUX-native deps via `npm ci` so esbuild/rollup/vite binaries match the
# container arch — the host `node_modules` (darwin) must NEVER be bind-mounted
# over this (the `frontend-dev` compose service uses an anonymous volume at
# /app/node_modules to preserve it). The nginx `runtime` stage above stays the
# DEFAULT final stage, so a bare `docker build ./frontend` (and the profile-free
# compose, which pins `target: runtime`) still produces the prod nginx image.
# Same digest-pinned node base as the builder stage.
FROM node:22-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS dev

WORKDIR /app

# Install from the committed lockfile for a reproducible dev toolchain.
COPY package.json package-lock.json ./
RUN npm ci

# Source is bind-mounted by compose for HMR; this only needs node + node_modules.
EXPOSE 5173

# --host 0.0.0.0 so the mapped port is reachable from the host browser.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
