# Production hardening checklist

Each item below is the verification path for one of the five Task 33
hardening requirements. Re-walk this list before every production
release; deviations need a written exception in the release notes.

## 1. next-auth pin + rollback

**Status:** pinned to `5.0.0-beta.30` (exact, no caret).

Verification:

```bash
npm run check:next-auth-pin
```

The script asserts `package.json`, `package-lock.json`, and the
allowlist (`scripts/prerelease-deps-allowlist.json`) all agree. CI
runs this in the `quality` step.

**Rollback procedure:** [docs/runbooks/next-auth-rollback.md](next-auth-rollback.md)
— covers both the re-deploy path (3 minutes) and the code-revert path
(when the deploy infra can't roll back).

## 2. Sentry end-to-end

**Status:** wired in [`instrumentation.ts`](../../instrumentation.ts) +
[`sentry.{server,client,edge}.config.ts`](../../sentry.server.config.ts).
Test endpoint at `/api/_test/sentry` for verification.

Verification:

```bash
TOKEN=<SENTRY_TEST_TOKEN>
CID=verify-$(date +%s)
curl -i -H "x-correlation-id: $CID" "https://app.example.com/api/_test/sentry?token=$TOKEN"
```

Within ~30 s a Sentry issue appears tagged
`probe=sentry-e2e correlation_id=verify-<ts>` with readable source
frames. Full procedure (including source-map sanity checks):
[docs/runbooks/sentry-e2e-verification.md](sentry-e2e-verification.md).

## 3. Rate limit load test

**Status:** scripted at
[`scripts/load-test-ratelimit.ts`](../../scripts/load-test-ratelimit.ts).
The configured rule is `auth-callback`: 10 attempts per IP per 5
minutes against `/api/auth/callback/credentials`. Source:
[`src/infra/ratelimit/config.ts`](../../src/infra/ratelimit/config.ts).

Verification (against a deploy or local `npm start` build):

```bash
npm run test:ratelimit -- \
  --target https://app.example.com \
  --ips 5 --rate 30 --duration 300
```

The script forges `x-forwarded-for` per IP. For this to work, the
runner must hit the app **through** the trusted reverse proxy that's
configured to accept that header (or run inside the deploy
environment). Direct hits from outside the proxy chain will all
bucket into the same IP and the test won't validate per-IP isolation.

Pass condition (script exit 0):
- For each simulated IP, the 11th + every subsequent request returns
  HTTP 429 with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
  `X-RateLimit-Reset` headers.
- Within the budget (1–10 / IP / 5 min), requests pass through to the
  upstream credentials check (which rejects them with 401 — the
  limiter doesn't intercept those).

## 4. Mozilla Observatory

**Status:** target A. Headers in
[`next.config.ts`](../../next.config.ts).

Verification:

```bash
npx -y @mdn/observatory-cli scan --target https://app.example.com --rescan
```

Pass condition: grade ≥ A. Known gap: CSP `script-src` still has
`'unsafe-inline'` (Next.js framework requirement until we wire a
nonce path). Documented in
[docs/runbooks/security-headers.md](security-headers.md).

## 5. Stub pages removed from navigation

**Status:** **Zero `<UnderConstruction />` pages exist in the
codebase.** The original spec assumed 27; the audit found none —
every nav `href` in
[`src/shared/config/navigation.ts`](../../src/shared/config/navigation.ts)
maps to a real `(dashboard)/.../page.tsx`.

Verification:

```bash
# Find any stub-style indicators:
grep -rEn "UnderConstruction|coming.soon|TODO.*page" src/app

# Verify every nav href backs onto a real page:
node -e '
const fs=require("fs");
const navText=fs.readFileSync("src/shared/config/navigation.ts","utf8");
const hrefs=[...navText.matchAll(/href:\s*"([^"?]+)/g)].map(m=>m[1]);
const exists=p=>fs.existsSync("src/app/(dashboard)"+(p==="/"?"":p)+"/page.tsx");
const missing=hrefs.filter(p=>!exists(p));
if(missing.length){console.error("Missing pages:",missing);process.exit(1)}
console.log(`✓ all ${hrefs.length} nav hrefs back onto real pages`);
'
```

Both should report 0 issues. If a future PR introduces a stub, the
second check fires and CI must be wired to fail on it (today this
check runs ad-hoc; consider promoting it to a CI script if stubs
return).

## When to walk this list

- **Every production release.** The five checks are 10 minutes total
  and cheap insurance.
- **After any change to `middleware.ts`, `next.config.ts`,
  `instrumentation*.ts`, `sentry.*.config.ts`, or
  `src/infra/ratelimit/`.** These are the touchpoints the items above
  validate.
- **After a `next-auth` upgrade** — re-walk item 1 + item 2 (auth
  changes can shift error shapes that Sentry's deduplication is keyed
  on).
