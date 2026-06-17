# Cross-Platform CI Matrix + E2E — Report

**Repository:** Dashboard-Frontend (Next.js 16 / React 19, npm)
**Date:** 2026-06-17
**Scope:** CI configuration + an honest assessment of the existing E2E suite. No
application source or behavior was changed.

---

## Summary

| Deliverable | Status |
| --- | --- |
| **Cross-platform unit-test matrix (Linux + Windows)** | ✅ **Delivered** |
| **E2E job as a required gate** | ⚠️ **Not wired — deliberately.** The existing E2E specs do not pass against the current UI; per the task's "do not fake a green gate" rule, no red/required check was added. Validated findings + a concrete enable recipe are below. |

The high-value goal — catching the **OS-specific bug class** that caused multiple
recent production failures (Windows-only path handling that broke on Linux) — is
fully met by the unit matrix. The E2E suite needs real per-spec work before it can
gate; that is scoped here rather than faked.

---

## 1. Cross-platform unit-test matrix — delivered

`.github/workflows/ci.yml`, `test` job:

```yaml
  test:
    name: Unit tests
    runs-on: ${{ matrix.os }}
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx vitest run
```

- **Why:** the dev environment is Windows; CI default is Linux. The git-bridge path
  bug (Windows-only separator handling) shipped because only Linux ran in CI. Running
  **both** OSes closes that gap in both directions.
- `fail-fast: false` so a failure on one OS still reports the other.
- The `build` job's `needs: [quality, test]` correctly waits for **both** matrix legs.
- **Verification:** `npx vitest run` passes **1613/1613** on this Windows box (the
  Windows leg) and already passes on Linux CI (the existing leg). No dependency or
  lockfile change, so `npm ci` is unaffected.

---

## 2. E2E suite — investigation & honest findings

### 2.1 What was validated (works)

- The app boots **self-contained in mock mode** (`NEXT_PUBLIC_USE_MOCK_API=true`) with
  **no backend**, via a Playwright `webServer`. In a local run the server started, the
  `/auth/login` page rendered (Arabic locale, brand panel, feature list), and the
  matching Chromium was installed.
- Mock auth accepts any credentials (so `demo/demo` can drive a real login flow).

### 2.2 What blocks gating (the specs don't match the current UI)

Running `e2e/auth.spec.ts` against the booted mock app surfaced **real spec/UI drift**,
not infrastructure problems:

| Spec expectation | Actual UI | Effect |
| --- | --- | --- |
| `getByRole('heading', { level: 1 })` visible | The login heading renders at **level 2** | assertion fails |
| `input[name='username']` / `input[type='password']` present immediately | The page first shows a **"verifying session…"** loading state; the form mounts only after the client `useSession()` check resolves | `page.fill` times out |
| Authed routes (dashboard/list/edit) gated on a pre-captured `APP_E2E_AUTH_COOKIE` env var | No session cookie is produced anywhere → those tests **skip** | near-zero real coverage |
| `rtl-screenshots.spec.ts` baseline is **`…-win32.png`** only | Linux CI looks for `…-linux.png` (different OS, different pixel rendering) | screenshot test fails on Linux |

**Conclusion:** the E2E specs are aspirational and have drifted from the current UI.
Forcing them into a required gate would mean a permanently-red check or suppressing
failures with `continue-on-error` — both explicitly disallowed.

### 2.3 Recommended follow-up (concrete recipe to make E2E gate)

A focused, separate task — roughly in this order:

1. **Auth via `storageState`, not an env cookie.** Add a Playwright `setup` project that
   logs into the mock app (`demo/demo`), waits for the post-login redirect, and saves
   `storageState`. Have the authed specs consume it (`use: { storageState }`) instead of
   `APP_E2E_AUTH_COOKIE` + `test.skip`. This unlocks the dashboard/list/edit flows.
2. **Self-contained server.** Add a `webServer` block (mock mode) — prefer a **production
   build** (`next build && next start`) over `next dev` so there is no compile-on-demand
   latency to make the session-check race flaky.
3. **Fix the drifted selectors/waits** (heading level; wait for the login form to mount
   after the session check; verify each spec against the real DOM).
4. **Screenshots:** run `rtl-screenshots.spec.ts` on **Windows** (matching the `-win32`
   baseline) or regenerate per-OS baselines; exclude it from the Linux functional run
   (`--grep-invert "RTL screenshots"`).
5. Wire an `e2e` job: `npx playwright install --with-deps chromium`, run the functional
   suite, upload the HTML report/traces on failure, `retries: process.env.CI ? 2 : 0`.
   Promote to **required** only after it is green across ≥3 runs.

---

## 3. Acceptance criteria — honest status

| # | Criterion | Status |
| --- | --- | --- |
| 1 | `ci.yml` valid YAML; `test` job runs `[ubuntu-latest, windows-latest]` | ✅ |
| 2 | `npx vitest run` passes on Windows (proves the Windows leg) | ✅ 1613/1613 |
| 3 | E2E suite passes against mock mode | ❌ **Specs drifted from UI** (§2.2) — not faked; recipe in §2.3 |
| 4 | `npx -y npm@10 ci …` → exit 0 (lock valid) | ✅ no dep/lock change this task |
| 5 | Existing gates unaffected (`quality`, `next build --webpack`) | ✅ unchanged |
| 6 | Any Windows source fix is real + documented | ✅ none needed (unit suite already cross-platform after the earlier git-bridge fix) |
| 7 | This report | ✅ |

**Net:** the cross-platform guard (the part with the highest return and the direct
cause of the recent incidents) is shipped and verified. The E2E gate is honestly
deferred with a precise plan rather than faked.

---

## 4. Change set

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | `test` job → `[ubuntu-latest, windows-latest]` matrix (`fail-fast: false`) |
| `playwright.config.ts` | Investigated a `webServer` for self-contained E2E; **reverted** (kept the change set focused since E2E is not yet gated) |
