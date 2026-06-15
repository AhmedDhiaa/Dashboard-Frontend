# next-auth rollback runbook

## Why this runbook exists

`next-auth@5.0.0-beta.30` is a beta. The pin guard
([scripts/check-next-auth-pin.mjs](../../scripts/check-next-auth-pin.mjs))
prevents drift inside the repo, but it doesn't prevent the upstream from
shipping a regression that only manifests at runtime — a session callback
contract change, a cookie-shape break, an OAuth refresh-flow rewrite.
This runbook is the playbook for the moment that happens.

## Pin verification (do this first)

```bash
npm run check:next-auth-pin
```

Confirms `package.json` and `package-lock.json` both resolve to the
exact `EXPECTED` revision. If this fails, **stop** — somebody bumped
`next-auth` outside the documented procedure. Investigate the diff
before doing anything else.

The current pin is mirrored in three places:
- [`package.json`](../../package.json) — `dependencies.next-auth = "5.0.0-beta.30"` (exact, no caret).
- [`scripts/check-next-auth-pin.mjs`](../../scripts/check-next-auth-pin.mjs) — `EXPECTED` constant.
- [`scripts/prerelease-deps-allowlist.json`](../../scripts/prerelease-deps-allowlist.json) — explicit beta approval.

All three must agree. CI fails the build otherwise.

## Symptoms that warrant a rollback

Any one of the following, in production:

1. **Login broken for everyone.** New sessions fail on the credentials
   provider. Inspect Sentry's `auth.callback` issues and the
   `/api/auth/callback/credentials` 5xx rate.
2. **Session refresh broken for existing users.** Users get logged out
   after the access-token TTL even though refresh tokens are valid.
   Look for spikes in `RefreshAccessTokenError` events and the
   `/auth/session-expired` redirect rate.
3. **JWT cookie shape regression.** Existing cookies fail to decode
   server-side; users see "session error" banner across the app.
4. **Cross-tab session sync broken.** Sign-out in one tab doesn't
   propagate; the other tab still acts as authenticated.

A single regression in any of the above warrants rollback. We do not
hot-patch beta auth in production.

## Rollback (the 3-minute path)

The currently-deployed pin **is** our rollback target — re-deploying the
last known-good build is faster than reverting code.

1. **Re-deploy the last green build** from CI. In the GitHub Actions
   "build" job artefacts, find the most recent run on `main` *before*
   the bad change. Re-run the deploy step against that artefact.
2. **Invalidate the CDN cache** so the bad build doesn't get served
   from edge for users who refresh during the window.
3. **Force-revoke active sessions** if the regression involved the
   cookie shape: bump `NEXTAUTH_SECRET` in the production environment
   (every existing JWT is now invalid; users sign in fresh against the
   rolled-back code). Document the revocation in the incident channel.
4. **Confirm health.** `/api/health` should return 200 and the
   `/auth/login` page should be reachable. Run the Playwright login
   spec with production credentials:
   ```bash
   APP_E2E_BASE_URL=https://app.example.com \
   APP_E2E_USERNAME=... \
   APP_E2E_PASSWORD=... \
   npm run test:e2e:rtl -- --grep "submits credentials"
   ```

## Rollback (the code path, when re-deploy isn't viable)

Use this if the deploy infra itself can't roll back (e.g., a database
migration shipped alongside the auth change and rolling back the deploy
would leave the schema ahead of the code).

1. Set `EXPECTED` in [`scripts/check-next-auth-pin.mjs`](../../scripts/check-next-auth-pin.mjs)
   back to the previous beta revision (most recent line in this file's
   history, or the one referenced in the previous incident's PR).
2. `package.json` — set `"next-auth": "<previous-beta>"` (exact, no
   caret).
3. `npm install next-auth@<previous-beta> --save-exact` to refresh the
   lockfile.
4. Update [`scripts/prerelease-deps-allowlist.json`](../../scripts/prerelease-deps-allowlist.json) `version` field to match.
5. Run the affected paths locally before deploying:
   ```bash
   npm run check:next-auth-pin   # all three sources agree
   npm run type-check
   npm run lint
   npm run test
   ```
   Then a manual smoke: login, logout, session refresh (force a token
   refresh by sleeping past the access-token TTL), cross-tab sync (open
   a second tab, sign out in tab A, click any nav link in tab B).
6. Open the rollback PR with the incident number in the title and the
   regression summary in the description. CI must pass before merge.

## Forward path: upgrading off beta

When `next-auth` v5 ships a stable release on npm:

1. Read the CHANGELOG between the current pin and the stable release.
   Pay special attention to JWT/session callback signatures, provider
   config shape, and middleware contract.
2. Bump the pin in all three locations (`package.json`,
   `check-next-auth-pin.mjs`, `prerelease-deps-allowlist.json`).
3. Once on stable, **delete the beta entry** from
   `prerelease-deps-allowlist.json` and **remove the pin guard** from
   the CI quality gate (`package.json#scripts.quality`). Replace the
   exact pin with a normal caret range.
4. Reference the diff in the PR description so the deletion is
   reviewable.

## Don't

- Don't merge a `next-auth` bump as part of a feature PR. It always gets
  its own PR with the rollback runbook linked in the description.
- Don't use `npm install next-auth@latest` — `latest` resolves to a
  beta until v5 ships stable, and the install will silently downgrade
  if the registry's `latest` tag points at an older beta.
- Don't comment out the pin guard "just for this PR". CI removing this
  guard is how the original incident happened.
