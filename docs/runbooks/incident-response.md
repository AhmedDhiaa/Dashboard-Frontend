# Incident response — one page

**Skim this. The on-call should reach the right dashboard in <60 s.**

Every link below is meant to be **bookmarked** in the team's password
manager / shared bookmarks. The `<org>/<project>` placeholders are
filled in by whoever sets the bookmarks; this file is the canonical
recipe for what each link is.

## 0. The first 60 seconds

Open these three tabs in order. If the **first** is red, you have your
answer in 10 seconds.

| # | Tab | What it tells you |
| --- | --- | --- |
| 1 | **Errors-by-route dashboard** ↓§1 | Which route is throwing right now, and at what rate. |
| 2 | **P95 latency dashboard** ↓§2 | Whether a route is timing out (slow ≠ broken; both can page). |
| 3 | **Top issues feed** ↓§3 | The five issues driving today's noise, newest-first. |

If all three look clean, the page is upstream — open the staging/prod
`/api/health` (links at the bottom of the deploy-cd runbook) and check
the upstream API's own status before assuming it's us.

## 1. Errors by route — `Errors-by-route` dashboard

**Sentry → Insights → Discover → New query.** Save as
`acme: errors-by-route`.

| Field | Value |
| --- | --- |
| Dataset | **Errors** |
| Visualization | Top 5, **bar chart**, time bucket = 1 min, range = last 24 h |
| Y-axis | `count()` |
| Group by | `transaction` (the route name) |
| Filter | `event.type:error environment:production` |

**What "looks healthy"**: a single green-ish band at <2 errors/min per
route. **What looks sick**: a stacked bar shooting up from one route —
that's the regression.

Click the offending bar → **Open in Issues** to jump to §3 with the
filter pre-applied.

## 2. P95 latency by route — `Slow-routes` dashboard

**Sentry → Insights → Discover → New query.** Save as
`acme: p95-latency`.

| Field | Value |
| --- | --- |
| Dataset | **Transactions** |
| Visualization | Top 5, **line chart**, time bucket = 5 min, range = last 24 h |
| Y-axis | `p95(transaction.duration)` |
| Group by | `transaction` |
| Filter | `event.type:transaction environment:production transaction.op:[http.server,navigation]` |

A page about a "slow site" without a corresponding spike in §1 means
**latency, not errors** — usually the upstream API or a cold cache.
Cross-check with the Web Vitals view (§4 below).

## 3. Top issues feed — `Top-issues` saved search

**Sentry → Issues → Saved search → New.** Save as
`acme: top-issues-prod`.

| Field | Value |
| --- | --- |
| Filter | `is:unresolved environment:production age:-24h` |
| Sort by | **Events** (descending) |
| Visible columns | Issue, Events, Users, First seen, Last seen, Trend |

If a row's **Last seen** is "less than a minute ago" AND its event
trend is climbing, that issue is the active fire. Open it; the
breadcrumb trail at the top of the issue detail shows the user's
recent navigation + the failed request.

## 4. Web Vitals (per-route) — bonus diagnostic

**Sentry → Insights → Web Vitals.** No saved-search needed; Sentry's
built-in view groups by `transaction` automatically.

The Web Vitals reporter in [src/app/WebVitalsReporter.tsx](../../src/app/WebVitalsReporter.tsx)
attaches `measurements.lcp` / `.cls` / `.inp` / `.fcp` / `.ttfb` to
every page-load transaction — see
[src/shared/utils/web-vitals.ts](../../src/shared/utils/web-vitals.ts).
A regression that shows as "site feels janky" without an error spike
usually shows here as a route with **P75 LCP > 2500 ms** or
**P75 INP > 200 ms**.

## 5. How to revert a release

Use this when §1 / §3 implicate code that landed in the latest deploy.

### Fastest path (re-deploy the previous green build)

The CI job tags every main-branch image with the commit SHA at
`ghcr.io/<owner>/<repo>:<sha>`. Walk back to the previous green commit:

1. **GitHub → Actions → CI →** filter by branch=main, status=success.
   Pick the last run before the bad change.
2. **Actions → Deploy production →** click "Run workflow", pass:
   - `image_sha` = the SHA from step 1 (full or first 12 chars; it's
     normalized to a tag).
   - `reason` = "rollback: <issue link>"
3. Approve the `production` environment gate when prompted.
4. The workflow re-tags the old image as `:production` and deploys.
   The smoke check at the end hits `/api/health`; you'll see green or
   the run will fail loudly.

Total time: **~3 minutes** including the reviewer-approval step.

### Special case: next-auth regression

If the failing route is `/api/auth/*` or session refresh is broken,
follow [next-auth-rollback.md](./next-auth-rollback.md) instead — that
runbook covers the cookie-revocation + pin-bump flow that a generic
release rollback can't fix.

## 6. How to disable a feature flag

The codebase has three production-relevant flags. **Changing any of
these requires a deploy** — they're read at server boot, not
re-evaluated per request. Until a real flag service ships, treat
"flip the env var + redeploy" as the procedure.

| Flag | Default | Effect when set to `false` (or empty for the killswitches) |
| --- | --- | --- |
| `NEXT_PUBLIC_ENABLE_CHAT` | `true` | Hides the chat surfaces in `/tickets/*`. Existing data stays; only the UI is gated. |
| `NEXT_PUBLIC_ENABLE_MAPS` | `true` | Hides the tracking map and the order-on-map widget. The Google Maps SDK isn't loaded. |
| `APP_ALLOW_RUNTIME_CODEGEN` | empty (off in prod) | When empty, the entity-builder / widget-builder / materialize endpoints refuse writes (read-only). Most powerful immediate-mitigation switch. |

### Disabling steps (any of the above)

1. **Update the production environment's variable** in your platform
   dashboard (Vercel "Environment variables", k8s ConfigMap, Render
   "Environment", etc.). Set the flag to `false` (or empty for
   `APP_ALLOW_RUNTIME_CODEGEN`).
2. **Trigger a redeploy.** On Vercel/Render the env-var change does
   this automatically. On a self-hosted setup, run the `Deploy
   production` workflow with the current main HEAD SHA — the new pod
   picks up the changed env without a code change.
3. **Confirm.** Hit a route that exercised the flag. The chat/map UI
   should now be hidden; codegen endpoints should return 503 for write
   attempts.

For codegen specifically, the simpler nuclear option is **rate-limit
the codegen endpoints to zero**:
[src/infra/ratelimit/config.ts](../../src/infra/ratelimit/config.ts) →
set `max: 0` on the `codegen-entity` / `codegen-widget` /
`codegen-materialize` rules → ship a 1-line PR. Faster than rotating
env vars on some platforms.

## 7. After the incident

Within 24 hours:
- File a postmortem in `docs/postmortems/<YYYY-MM-DD>-<slug>.md` (no
  template enforced; the dashboard above told you what to write — what
  the alert was, what the fix was, what the time-to-mitigate was).
- If the regression slipped through CI, look at which check should
  have caught it and add or tighten it. The five most useful gates
  today are listed in [production-hardening.md](./production-hardening.md);
  the bundle-budget rule in
  [scripts/check-bundle-budget.mjs](../../scripts/check-bundle-budget.mjs)
  is the canonical example of "convert a regression into a CI failure".

---

**Bookmark page:** keep these tabs pinned in your browser:

- §1 Errors-by-route dashboard
- §2 P95 latency dashboard
- §3 Top issues feed (saved search)
- §4 Web Vitals view
- The `Deploy production` workflow run page (for §5)
- The platform's env-var settings page (for §6)
