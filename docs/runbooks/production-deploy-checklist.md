# Production deploy checklist

The single "before you ship to a real backend" reference. Deeper detail lives in
[`production-hardening.md`](production-hardening.md), [`deploy-cd.md`](deploy-cd.md)
and [`security-headers.md`](security-headers.md); this page is the pre-flight list.

> **Mental model:** `NEXT_PUBLIC_*` are **baked into the client bundle at build
> time**. Everything else is read at **runtime**. Get that distinction wrong and
> the app builds fine but can't reach your backend in the browser.

---

## 1 · Build-time config (client bundle) — set as Docker `--build-arg` / CI Variables

These are inlined by `next build`; injecting them at `docker run` is a **no-op**
for the browser. In GitHub Actions set them under *Settings → Secrets and
variables → Actions → **Variables*** (they're public — they end up in the bundle).

- [ ] `NEXT_PUBLIC_API_URL` — your ABP API root (e.g. `https://api.example.com`)
- [ ] `NEXT_PUBLIC_CLIENT_ID` — ABP OAuth2 public client id
- [ ] `NEXT_PUBLIC_SOCKET_URL` — SignalR hub (defaults to API URL if unset)
- [ ] `NEXT_PUBLIC_BRAND_DOMAIN` / `NEXT_PUBLIC_APP_NAME` — white-label identity
- [ ] `NEXT_PUBLIC_MAP_PROVIDER` (`leaflet` free / `google`) + `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` if Google
- [ ] `NEXT_PUBLIC_SENTRY_DSN` — client error tracking (else client errors are invisible)
- [ ] `NEXT_PUBLIC_USE_MOCK_API` — **must be `false`** (CI pins it; the Dockerfile default is `false`)
- [ ] `SENTRY_AUTH_TOKEN` (a **Secret**) + `SENTRY_ORG`/`SENTRY_PROJECT` — for source-map upload (else prod stack traces are minified)

The Dockerfile and `docker-publish.yml` already wire all of these; you only fill
the values. Unset → safe placeholder defaults (the build still succeeds).

## 2 · Runtime secrets (server) — inject at `docker run -e` / k8s Secret

- [ ] `AUTH_SECRET` (or `NEXTAUTH_SECRET`) — **≥32 chars** (`openssl rand -base64 32`). Boot fails fast without it (now enforced on the standalone path via `instrumentation.ts`).
- [ ] `NEXTAUTH_URL` — canonical app URL; `AUTH_TRUST_HOST=true` only behind a trusted proxy.
- [ ] `OAUTH2_CLIENT_SECRET`, `OAUTH2_ISSUER` — ABP OAuth2 server credentials.
- [ ] `API_URL` — **private** backend URL for server-side calls (avoids hairpin-NAT in Docker/k8s; falls back to `NEXT_PUBLIC_API_URL`).
- [ ] `NODE_ENV=production` (set by the Dockerfile/compose; required to arm every safeguard).

## 3 · Rate-limit shared store (multi-instance)

The in-memory limiter is **per-process** — useless behind a load balancer. Boot
**refuses** in production without one of:

- [ ] `REDIS_URL` (self-hosted Redis, Node runtime) — `ioredis` ships as an optional dependency; **confirm it's present in the image** (the standalone bundle doesn't trace it — see note below), or
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (edge-safe HTTP), or
- [ ] `APP_ALLOW_INMEMORY_RATELIMIT_PROD_OVERRIDE=i-understand-the-risks` for a deliberate single-instance deploy.

> **Standalone caveat:** the Redis adapters are dynamic-imported with
> bundler-ignore (so the Edge bundle stays clean), which means they are NOT
> traced into `.next/standalone/node_modules`. If you set `REDIS_URL` for a
> standalone Docker image, either copy `node_modules/ioredis` into the image or
> deploy the full `node_modules` (`npm start` / IIS path). Watch the boot log
> for `[ratelimit] backend: in-memory` — if you see it with Redis env set, the
> adapter isn't in the image.

## 4 · Health & probes

- [ ] Point your orchestrator readiness/liveness probe at **`/api/health`**.
- [ ] Contract: `backend` down → `503 "down"`; `backend` up + storage write fails → `200 "degraded"` (still serving); both up → `200 "ok"`.
- [ ] On a hardened **`readOnlyRootFilesystem`**, mount `messages/_overrides/` as a writable volume **only if** admins will edit i18n/theme/runtime overrides — otherwise `storage` reports `fail` advisorily and that's fine.

## 5 · Pick a deployment target

- **Docker / k8s (recommended):** `output: standalone` → `node server.js`. Image is multi-stage, non-root, with a built-in `HEALTHCHECK`. The custom `server.ts` is bypassed here — its env validation + large-header tolerance are restored via `instrumentation.ts` and `NODE_OPTIONS` in the Dockerfile.
- **Bare Node / PM2:** `npm run build && npm run start` (full `node_modules`, so Redis adapters resolve).
- **IIS + iisnode:** point `web.config` at the transpiled `server.ts` (the only path that uses it).

## 6 · Pre-flight verification

- [ ] `npm run quality` green (type-check, lint, architecture, i18n, swagger-drift, leaked-secrets, codegen-flag…).
- [ ] `npm run build` succeeds + `npm run check:bundle-budget` within budget.
- [ ] After deploy: `curl https://<host>/api/health` → `200 {"status":"ok"…}`.
- [ ] Sign in with a real account; confirm the network tab hits your **real** `NEXT_PUBLIC_API_URL` (not the frontend origin → the #1 sign the build-args weren't passed).
- [ ] Confirm `APP_ALLOW_RUNTIME_CODEGEN` is **unset/false** in production (boot refuses otherwise).
