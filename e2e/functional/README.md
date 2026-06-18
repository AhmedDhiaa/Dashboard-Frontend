# Functional E2E (standalone mock server)

End-to-end tests that drive the **real app** — login, navigation, the CRUD list
shell — against a spawned **mock** server (`NEXT_PUBLIC_USE_MOCK_API=true`, seeded
in-memory data, **no backend**). This is the CI gate for "the app actually boots,
authenticates, and routes".

Distinct from the RTL screenshot suite (`playwright.config.ts`), which only checks
layout snapshots.

## Run

```bash
npm run test:e2e          # spawns the mock dev server + runs the suite
```

Config: [`playwright.functional.config.ts`](../../playwright.functional.config.ts).
Playwright owns the server lifecycle (`webServer`) on port 3100 with a throwaway
`AUTH_SECRET`, so no manual setup is needed.

## How auth works

`auth.setup.ts` logs in once as the documented mock `demo / demo` user and saves
the session to `e2e/.auth/user.json` (git-ignored); every other spec reuses it via
`storageState`.

Two non-obvious requirements make this reliable — change them at your peril:

1. **`webServer.url` points at `/auth/login`, not `/`.** The dev server compiles
   routes on demand; pointing the readiness probe at the login route forces its
   (slow) cold compile to happen during startup rather than inside the test.
2. **`await page.waitForLoadState("networkidle")` before `storageState()`.** The
   credentials-callback `Set-Cookie` lands a tick after the redirect resolves;
   snapshotting too early saves a cookie-less (unauthenticated) state. The setup
   asserts the `session-token` cookie is present as a guard against this.

## Coverage & intentional limits

- `auth.setup` — login flow end to end (the credentials → JWT → session path).
- `smoke` — the dashboard renders real content for the authed user.
- `nav` — every core sidebar route is reachable, authenticated, and not a 404.
- `crud` — the entity list shell renders authenticated.

Deep per-row CRUD content is intentionally **not** asserted here: under the
dev-server + mock + `PagePermissionGuard` + Suspense combination, list bodies can
render as a skeleton with non-deterministic timing, which would make the gate
flaky. The dashboard (`smoke`) covers real content rendering; the list specs cover
reachability + auth. Promote these to data-level assertions once the suite runs
against a production build (no on-demand compile).
