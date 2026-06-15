# Sentry end-to-end verification

## What this checks

The Sentry SDK is wired in three places:
- [`instrumentation.ts`](../../instrumentation.ts) — branches by
  `NEXT_RUNTIME` and loads the Node SDK on the server.
- [`sentry.server.config.ts`](../../sentry.server.config.ts) — server init.
- [`instrumentation-client.ts`](../../instrumentation-client.ts) +
  [`sentry.client.config.ts`](../../sentry.client.config.ts) — browser init.

Each environment (staging, prod) needs to confirm that:

1. An error thrown in a server route reaches the Sentry project.
2. The issue carries the deploy's `release`, `environment`, and
   `correlation_id` tags.
3. Stack frames show readable filenames + line numbers (source maps
   uploaded successfully during the deploy).

This runbook exercises all three with a single intentional error.

## Prerequisites

- `SENTRY_DSN` set on the server (no `NEXT_PUBLIC_` prefix — server
  errors only).
- `NEXT_PUBLIC_SENTRY_DSN` set if you also want client errors.
- `SENTRY_TEST_TOKEN` set on the environment under test. Generate a
  fresh one for each verification round so an old token can't be reused
  by a tester:
  ```bash
  openssl rand -hex 16
  ```
- The deploy's `SENTRY_RELEASE` and `SENTRY_ENVIRONMENT` are set
  correctly. These tag every issue and are how the on-call filters
  noise from staging.

## Triggering the probe

Once `SENTRY_TEST_TOKEN` is configured, hit the test endpoint with the
token and a correlation ID. The endpoint throws on purpose; that's the
desired behavior.

```bash
TOKEN=<your test token>
CID=verify-$(date +%s)

curl -i \
  -H "x-correlation-id: $CID" \
  "https://app.example.com/api/_test/sentry?token=$TOKEN"
```

Expected response: `HTTP/1.1 500` with the framework's default error
page. The route handler intentionally throws; Next.js renders the
500 page and `onRequestError` ships the error to Sentry.

## Verifying in Sentry

Within ~30 seconds the project should show a new issue:

- **Title**: `SentryProbeError: Test error from /api/_test/sentry (uncaught mode)`
- **Tags**:
  - `probe: sentry-e2e`
  - `correlation_id: verify-<timestamp>` (matches the header you sent)
  - `runtime: nodejs`
  - `environment: <SENTRY_ENVIRONMENT>`
  - `release: <SENTRY_RELEASE>`
- **Stack trace**: the topmost frame is `route.ts:60` (or whatever
  line the `throw` ends up on). If the frame shows a numeric chunk
  hash like `0g.enyof3b0tc.js:1:1234`, **source-map upload failed** —
  see "Source maps not resolving" below.

Compare the `correlation_id` tag value against the `$CID` you sent.
They must match. If they don't, the request didn't reach our route —
check for a CDN or load-balancer that's stripping the header.

## Captured (non-throwing) path

To verify the manual capture path used by `errorHandler.handle()`:

```bash
curl -i "https://app.example.com/api/_test/sentry?token=$TOKEN&mode=captured" \
  -H "x-correlation-id: $CID-captured"
```

Returns 200 with a JSON acknowledgement. Sentry should still record an
issue, this time titled `... (captured mode)`. This validates that
`Sentry.captureException()` calls outside the `onRequestError` path
also reach the project.

## Cleanup

After verification:

- **Resolve the test issues** in Sentry so they don't trigger noise
  alerts. A bulk-resolve filter on `tag:probe=sentry-e2e` works.
- **Rotate `SENTRY_TEST_TOKEN`** if testers outside the on-call rota
  had it — it stays valid forever otherwise.

## Failure modes

### Issue never appears

In order:

1. Confirm the request reached our app (200/500 in our access log, not
   a CDN error page).
2. Confirm the deploy injected `SENTRY_DSN` — `printenv SENTRY_DSN`
   inside the running container.
3. Confirm the SDK didn't no-op: visit `/api/_test/sentry` without the
   `token` param; you should get 503 with "SENTRY_TEST_TOKEN is not
   configured" — that confirms the route loaded. Then check that
   `Sentry.init()` ran (look for `Sentry: SDK loaded` in the boot
   logs).
4. Sanity-check Sentry's project quota — over-quota projects silently
   drop events.

### Source maps not resolving

Stack frames show numeric chunk hashes instead of source paths.
Source map upload happens during the build via `@sentry/nextjs`'s
webpack plugin (`withSentryConfig` in [`next.config.ts`](../../next.config.ts)).

1. Confirm the deploy ran with `SENTRY_AUTH_TOKEN` set (the upload
   step needs it).
2. Confirm the deployed `SENTRY_RELEASE` matches the build's release
   tag exactly. Mismatch = Sentry can't pair the maps with the
   release.
3. Re-trigger upload manually if needed:
   ```bash
   npx sentry-cli sourcemaps upload \
     --org $SENTRY_ORG --project $SENTRY_PROJECT \
     --release $SENTRY_RELEASE \
     .next/static
   ```

### Correlation ID missing

The tag value should match the header you sent.

- If the tag is empty: a proxy stripped the header. Check
  load-balancer / CDN config — the `x-correlation-id` header has to be
  forwarded.
- If the tag is missing entirely: the `Sentry.setTag(...)` call
  didn't run (hot-reload loaded an older build). Restart the server.
