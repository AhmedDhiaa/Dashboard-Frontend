# Deploy hygiene runbook

Walks Task E4: standalone build smoke test, Docker image hygiene, and
Brotli-at-the-edge. Use this before promoting an image to production.

## 1. Standalone build smoke test

`next.config.ts` sets `output: "standalone"` so `next build` emits a
self-contained server bundle at `.next/standalone/`. This is what ships
in the Docker image; the smoke test verifies it boots and serves a
real route before we trust it on a host.

### Build + stage

```bash
npm ci
npm run build                                # writes .next/{standalone,static}
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public
```

Skip the `cp` if your CI already does it (the build job in
`.github/workflows/ci.yml` does — see "Stage standalone runtime").

### Boot

```bash
cd .next/standalone
PORT=3000 NODE_ENV=production node server.js &
SERVER_PID=$!
sleep 1   # cold-start margin; healthy boots return well under this
```

**Pass criterion #1**: server logs `Ready in <N> ms` within **3 seconds**
of starting `node server.js`. If it takes longer, check that the deps
trim worked (the standalone tree should be ~300 MB tops, not 1+ GB),
and that `init-entities` isn't running at boot.

### First-byte timing

```bash
curl -o /dev/null -s -w 'status=%{http_code} ttfb=%{time_starttransfer}s\n' \
  http://127.0.0.1:3000/api/health
```

**Pass criterion #2**: TTFB on `/api/health` is **under 100 ms** on a
warm cache. The route's two probes (backend + storage) run in parallel
with a 2-second budget each, so the slow path is bounded by network
RTT to the backend, not the BFF itself. A cold first request can be
~200-300 ms (initial connection pool, JIT) — measure the second hit.

### Health response

```bash
curl http://127.0.0.1:3000/api/health | jq .
```

**Pass criterion #3**: response is exactly
`{ "status": "ok", "checks": { "backend": "ok", "storage": "ok" } }`
with HTTP 200. No extra fields, no env values, no stack traces (Task E1
locked this shape).

If `backend` is `fail`, the BFF can't reach `${API_URL}/api/abp/application-configuration`
within 2 s. Check `API_URL`, network egress, and the upstream's own
health.

If `storage` is `fail`, `messages/_overrides/` isn't writable. Check
the volume mount and the `nextjs:nodejs` user's permissions inside the
container.

### Cleanup

```bash
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null
```

## 2. Docker image hygiene

The image at `Dockerfile` is a three-stage build: `deps` → `build` →
`runner`. Verify the runtime image meets the production-hardening bar.

### Build

```bash
docker build -t acme-dashboard:smoke .
```

### Runs as non-root

```bash
docker run --rm --entrypoint id acme-dashboard:smoke
# Expected: uid=1001(nextjs) gid=1001(nodejs) groups=1001(nodejs)
```

**Pass**: `uid` is non-zero. The image's `USER nextjs` directive caps
the process; `runAsUser: 1001` in your Kubernetes manifest can pin it.

### Minimal base + no source

```bash
docker run --rm --entrypoint sh acme-dashboard:smoke -c 'ls -la /app | head -10'
# Expected entries: server.js, node_modules/, .next/, public/ (if present).
# NOT expected: src/, scripts/, e2e/, package-lock.json, tsconfig.json,
# Dockerfile, .git, anything under docs/.
```

**Pass**: only the standalone runtime tree is in `/app`. The
`.dockerignore` keeps source out of the build context; the multi-stage
build keeps it out of the final layer.

### Image size

```bash
docker image inspect acme-dashboard:smoke --format '{{.Size}}' \
  | awk '{ printf "%.0f MB\n", $1/1024/1024 }'
```

**Reasonable**: 200-400 MB on `node:22-alpine`. If you see 1+ GB,
something leaked devDependencies or `.next/cache` into the runner.

### Container start time

```bash
docker run --rm -d --name acme-smoke -p 3000:3000 \
  -e NEXTAUTH_SECRET=test -e API_URL=https://example.com \
  acme-dashboard:smoke
START=$(date +%s.%N)
until curl -sf http://127.0.0.1:3000/api/health > /dev/null; do
  sleep 0.1
  NOW=$(date +%s.%N)
  if (( $(echo "$NOW - $START > 5" | bc -l) )); then
    echo "FAIL: never became ready within 5s"
    docker logs acme-smoke
    docker rm -f acme-smoke
    exit 1
  fi
done
END=$(date +%s.%N)
echo "ready in $(echo "$END - $START" | bc) s"
docker rm -f acme-smoke
```

**Pass criterion**: ready in under **3 seconds**. Same target as the
standalone smoke test above; the container adds image-load overhead
which is the only meaningful difference.

## 3. Brotli compression at the edge

`next.config.ts` has `compress: true` — that's gzip in Next's built-in
Node response handler. Brotli is **not** done in-process: doing it
inside the request handler costs CPU on every dynamic response and
double-compresses anything Next already gzipped. Brotli belongs at the
edge: a CDN, a reverse proxy, or a load balancer that terminates TLS.

Pick the section matching your deployment shape.

### Vercel / Vercel-like edge

Brotli is **automatic** for static assets and dynamic responses. No
config required. Verify:

```bash
curl -H "Accept-Encoding: br" -I https://app.example.com/
# Expected: content-encoding: br
```

### Cloudflare (or any CDN with Brotli toggle)

In the dashboard: **Speed → Optimization → Brotli → On**. The toggle
applies to text-type responses (HTML, JS, CSS, JSON) — binary types
are skipped automatically.

### Self-hosted nginx in front of the standalone container

Add to the `server` block:

```nginx
brotli on;
brotli_comp_level 4;
brotli_static off;
brotli_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/javascript
    application/json
    application/xml+rss
    application/atom+xml
    image/svg+xml;
```

`brotli_comp_level 4` is the usual sweet spot — higher levels are
~2× slower per response for ~1-2 % less bytes. Pair with the existing
gzip config so old clients still get something:

```nginx
gzip on;
gzip_types <same list as brotli_types>;
gzip_vary on;
```

### Self-hosted Caddy

Brotli is on by default for text MIME types — no config required.

### Verify (any deployment)

```bash
# Brotli supported and applied:
curl -H "Accept-Encoding: br"  -I https://app.example.com/
# Expected: content-encoding: br

# Gzip fallback when client only accepts gzip:
curl -H "Accept-Encoding: gzip" -I https://app.example.com/
# Expected: content-encoding: gzip

# No compression when client doesn't accept any:
curl -I https://app.example.com/
# Expected: no content-encoding header
```

If `content-encoding: br` doesn't appear when Brotli should be active,
check (in order):

1. **Compressible content type.** Edge layers often skip Brotli for
   `application/octet-stream` or unknown MIMEs. The response's
   `Content-Type` header must be in the configured `brotli_types`.
2. **Cache layer.** A CDN may have cached an unencoded variant before
   Brotli was enabled. Purge the cache and recheck.
3. **Vary header.** If `Vary: Accept-Encoding` is missing, an
   intermediate cache may serve a Brotli response to a non-Brotli
   client. Make sure the upstream sets it (Next does for compressed
   responses; nginx adds it via `gzip_vary on;` and `brotli_vary on;`
   if you set the latter).

## 4. CI artifact

The `build` job in `.github/workflows/ci.yml` uploads the staged
standalone tree as the `build` artifact (14-day retention). To smoke-test
a CI build locally without rebuilding:

```bash
gh run download <run-id> -n build -D ./build-artifact
cd ./build-artifact
PORT=3000 NODE_ENV=production node server.js
# then run the curls from §1
```

## When to walk this list

- **Every container image release.** All four sections together are
  ~5 minutes after a build; cheap insurance against a regression in
  the standalone bundle, the image surface, or the edge compression
  config.
- **After any change to `Dockerfile`, `.dockerignore`,
  `next.config.ts#output`, the CI `build` job, or the reverse-proxy /
  CDN config.** Each is a touchpoint that one of the four sections
  validates.
