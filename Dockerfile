# syntax=docker/dockerfile:1.7
#
# Production image for the Acme dashboard.
#
# Three stages:
#   1. `deps`   — install only what `next build` needs (with dev deps).
#                 Cached aggressively against package-lock.json.
#   2. `build`  — run `next build`. Output is `.next/standalone` plus
#                 `.next/static` plus `public/` — the three pieces the
#                 standalone server needs at runtime. Source files do
#                 NOT enter the final image.
#   3. `runner` — minimal runtime. node:22-alpine, non-root user,
#                 only the standalone tree + static assets. The image
#                 surface is just enough to `node server.js`.
#
# Why standalone: `output: "standalone"` in next.config.ts emits a
# self-contained server bundle with only the production-needed
# node_modules transitively included. The full node_modules/ tree
# stays out of the final image.
#
# Why alpine: smallest popular base with a maintained Node 22 build,
# no glibc, no extras. If a binary native dep eventually requires
# glibc, swap to `node:22-slim` (Debian) — same multi-stage shape.
#
# Why non-root: a compromised process can't write to /app or /usr.
# The `nextjs:nodejs` user runs the server with no shell or login.
#
# Build:
#   docker build -t acme-dashboard .
# Run:
#   docker run --rm -p 3000:3000 \
#     -e NEXTAUTH_SECRET=... \
#     -e NEXTAUTH_URL=https://app.example.com \
#     -e API_URL=https://api.example.com \
#     acme-dashboard

# ─── 1. deps ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# `npm ci` needs both manifests; copying just the lockfile won't suffice.
# `--ignore-scripts` blocks postinstall scripts from running here — every
# such script is opt-in via `npm rebuild` later, never implicit on install.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts

# ─── 2. build ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Pull in the deps stage's resolved node_modules; copy the source last so
# the `npm ci` layer cache survives most edits.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Tell Next that we're building for standalone (already in next.config.ts;
# this is the belt-and-braces).
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# ─── Public (client-inlined) config — MUST be present at BUILD time ──────────
# Next inlines every `NEXT_PUBLIC_*` value into the client bundle during
# `next build`. Injecting them at `docker run` is a NO-OP for the browser, so
# they have to arrive as `--build-arg`s here. Pass them per-environment in CI:
#   docker build \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
#     --build-arg NEXT_PUBLIC_CLIENT_ID=Api_App ...
# Defaults keep `docker build` working with no args (it just produces a
# placeholder image). `NEXT_PUBLIC_USE_MOCK_API` defaults to "false" so a
# bare prod image never ships mock-wired.
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_SOCKET_URL=
ARG NEXT_PUBLIC_CLIENT_ID=
ARG NEXT_PUBLIC_BRAND_DOMAIN=example.com
ARG NEXT_PUBLIC_APP_NAME=Acme
ARG NEXT_PUBLIC_MAP_PROVIDER=leaflet
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=
ARG NEXT_PUBLIC_SENTRY_RELEASE=
ARG NEXT_PUBLIC_ENABLE_CHAT=true
ARG NEXT_PUBLIC_ENABLE_MAPS=true
ARG NEXT_PUBLIC_RUNTIME_BACKEND=server
ARG NEXT_PUBLIC_LOG_LEVEL=info
ARG NEXT_PUBLIC_USE_MOCK_API=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_PUBLIC_CLIENT_ID=$NEXT_PUBLIC_CLIENT_ID \
    NEXT_PUBLIC_BRAND_DOMAIN=$NEXT_PUBLIC_BRAND_DOMAIN \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_MAP_PROVIDER=$NEXT_PUBLIC_MAP_PROVIDER \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT \
    NEXT_PUBLIC_SENTRY_RELEASE=$NEXT_PUBLIC_SENTRY_RELEASE \
    NEXT_PUBLIC_ENABLE_CHAT=$NEXT_PUBLIC_ENABLE_CHAT \
    NEXT_PUBLIC_ENABLE_MAPS=$NEXT_PUBLIC_ENABLE_MAPS \
    NEXT_PUBLIC_RUNTIME_BACKEND=$NEXT_PUBLIC_RUNTIME_BACKEND \
    NEXT_PUBLIC_LOG_LEVEL=$NEXT_PUBLIC_LOG_LEVEL \
    NEXT_PUBLIC_USE_MOCK_API=$NEXT_PUBLIC_USE_MOCK_API

# Sentry source-map upload happens at build time (gated on the auth token).
# Without it, production stack traces stay minified/unsymbolicated.
ARG SENTRY_AUTH_TOKEN=
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN SENTRY_ORG=$SENTRY_ORG SENTRY_PROJECT=$SENTRY_PROJECT

# Quality is enforced in CI (`npm run quality`). The image build skips
# those checks to keep `docker build` fast — running them here would mean
# every image build replays type-check/lint, which CI already did.
#
# Use the webpack builder (matches `npm run build` and the CI "Production
# build" job). The default Turbopack production build fails to collect page
# data for some dynamic API routes (e.g. /api/admin/entities/[entityName]/
# convert); webpack builds them cleanly, so we pin the same builder here.
RUN npm run init-entities && npx next build --webpack

# Stage the runtime tree the standalone server expects: server.js plus
# the static assets next/image, font, and chunk requests resolve to.
# Doing this in the build stage means the runner can `COPY --from=build`
# a single tree.
RUN cp -r .next/static .next/standalone/.next/static \
    && if [ -d public ]; then cp -r public .next/standalone/public; fi

# ─── 3. runner ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# The standalone runtime uses Next's generated server.js, NOT the custom
# server.ts — so server.ts's `maxHeaderSize: 32768` is lost here. ABP JWT
# session cookies can exceed Node's 16 KB default and trigger HTTP 431, so
# restore the larger ceiling at the runtime level.
ENV NODE_OPTIONS="--max-http-header-size=32768"

# Non-root user. Numeric IDs match Next.js's documented convention so
# Kubernetes runAsUser / runAsGroup tooling can target them deterministically.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy ONLY the standalone runtime — server.js, the trimmed node_modules
# Next.js produced, .next/static, and public/. No source files, no
# devDependencies, no .next/cache, no build manifests we don't need.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./

USER nextjs

EXPOSE 3000

# Pre-flight readiness uses the /api/health route added in Task E1.
# Orchestrators (k8s, ECS) typically configure their own probes against
# this URL; the HEALTHCHECK below is for raw `docker run` parity.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
