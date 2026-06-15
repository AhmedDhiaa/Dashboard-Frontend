# Security headers + Mozilla Observatory

## Headers we emit

All in [`next.config.ts`](../../next.config.ts) under `headers()`,
applied to every route via `source: "/(.*)"`.

| Header                          | Value                                                    | Why                                                    |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `Strict-Transport-Security`     | `max-age=63072000; includeSubDomains; preload`           | Force HTTPS for 2 years, including subdomains.         |
| `X-Content-Type-Options`        | `nosniff`                                                | Stop browsers MIME-sniffing past the declared type.    |
| `X-Frame-Options`               | `DENY`                                                   | No iframing — anti-clickjacking. CSP also disallows.   |
| `X-XSS-Protection`              | `1; mode=block`                                          | Legacy IE/Safari XSS filter.                           |
| `Referrer-Policy`               | `strict-origin-when-cross-origin`                        | Don't leak full URLs across origins.                   |
| `Permissions-Policy`            | `camera=(), microphone=(), geolocation=(self)`           | Block features we don't use; allow geo for the maps.   |
| `Content-Security-Policy`       | (see source — `default-src 'self'` + per-source allows)  | Defence in depth against XSS + supply-chain.           |
| `X-Robots-Tag`                  | `noindex, nofollow`                                      | Authenticated app — never wanted in search engines.    |
| `Cross-Origin-Opener-Policy`    | `same-origin`                                            | Browsing-context isolation against tab-nabbing.        |
| `Cross-Origin-Resource-Policy`  | `same-site`                                              | No cross-site embedding of our resources.              |

## Running an Observatory scan

Mozilla Observatory grades a public origin against the headers + CSP
above. We target **A** (≥ 90).

```bash
# CLI (preferred — repeatable in CI):
npx -y @mdn/observatory-cli scan --target https://app.example.com --rescan

# Web UI fallback:
open https://developer.mozilla.org/en-US/observatory/analyze?host=app.example.com
```

The first scan after a deploy may report a stale grade — pass
`--rescan` to force a fresh fetch.

## Reading the result

Look for these line items in the report. Anything not "Pass" needs
investigation:

| Test                                | Expected      | Where it's set                         |
| ----------------------------------- | ------------- | -------------------------------------- |
| Content Security Policy             | A or A+       | `next.config.ts` `headers()`           |
| Cookies (Secure, HttpOnly, SameSite)| Pass          | NextAuth defaults; check session cookie|
| Cross-origin Resource Sharing       | Pass          | We don't set `Access-Control-*`        |
| HTTP Strict Transport Security      | Pass (≥ 6 mo) | `next.config.ts` HSTS line             |
| Redirection                         | Pass          | Edge / load balancer redirects HTTP → HTTPS |
| Referrer Policy                     | Pass          | `Referrer-Policy` header               |
| Subresource Integrity               | N/A           | Next bundles use hashed asset paths    |
| X-Content-Type-Options              | Pass          | `nosniff` header                       |
| X-Frame-Options                     | Pass          | `DENY` + CSP `frame-ancestors`         |

## Known gaps and the trade-off behind each

### CSP `script-src 'unsafe-inline'`

Observatory grades CSP A only when `unsafe-inline` is removed. Our
score caps in the upper-B range until this is gone. Removing it
requires:

- Migrating every inline `<script>` to a hashed/nonce'd source.
- The Next.js framework itself emits inline runtime code (route
  payloads, `__next_f` chunks). These need a request-time nonce that
  Next.js + react-server-components route through `experimental.cspNonce`.

This is a multi-PR migration. It's tracked separately; the current
header is pragmatic. **Do not** remove `'unsafe-inline'` from
`script-src` without first wiring the nonce-injection path or the app
will white-screen.

### CSP `style-src 'unsafe-inline'`

Same shape, simpler fix once the script-src nonce path lands — the
nonce can apply to styles too. Tailwind generates utility classes (no
inline styles) so the long tail here is small (Radix + framer-motion
inject inline styles for animations).

### `report-uri` / `report-to`

Not set. CSP violations currently surface only in the browser console
and Sentry's CSP integration. Adding a `report-uri` to a Sentry
ingestion endpoint would graduate violations into the same triage
queue as runtime errors — recommended next step.

## When CI should run this

The Observatory scan is **not** wired into CI today. Reasons:

- A flaky public DNS / external service shouldn't fail an internal
  build.
- Scanning every PR rate-limits Mozilla's free tier.

Run it after every production deploy that touches `next.config.ts`,
the auth flow, or anything in `middleware.ts`. Add the score to the
release notes.

## Local verification

To exercise the headers without a deploy:

```bash
npm run build && npm run start
curl -sI http://localhost:3000/ | grep -E "^(strict-transport|x-content-type|x-frame|referrer|permissions|content-security|cross-origin)"
```

Production-only headers (HSTS) are intentionally absent in dev — see
the comment in `next.config.ts`.
