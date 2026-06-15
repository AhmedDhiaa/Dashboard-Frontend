/**
 * Documented rate limits for sensitive endpoints.
 *
 * Each entry here is a defensive contract: the limit blocks abuse classes
 * (credential stuffing, password-reset spam, registration spam) without
 * disrupting normal user behaviour.
 *
 * Per-route rationale:
 *
 *   - `/api/auth/callback/credentials` — POST endpoint where NextAuth's
 *     credentials provider validates a username/password pair against the
 *     OAuth2 backend. This is the credential-stuffing target. **10 attempts
 *     per IP per 5 minutes** is generous for a real user (3 password
 *     mistypes + 2 retries over a few minutes still well within budget) and
 *     catches every plausible offline-list replay attempt — at 10 / 5 min,
 *     an attacker working a 10M-credential list against one IP would need
 *     ~9.5 years to test all of them.
 *
 *   - `/api/auth/signin` — NextAuth's signin page handler. Less sensitive
 *     than `callback/credentials` but worth a generous cap to slow scraping
 *     of CSRF tokens or signin-form probing. **20 / IP / minute.**
 *
 * Future endpoints (commented placeholders below) belong here as well —
 * `forgot-password` should be tighter than login (5 / IP / hour is typical)
 * because each attempt mails a real user; `register` similarly tight.
 *
 * The matcher in `middleware.ts` covers `/api/auth/:path*`, so any new
 * NextAuth route lands here automatically with no limit unless you add one
 * — that's intentional: prefer to err on the side of letting legitimate
 * traffic through, then add a row when a new endpoint becomes a target.
 *
 * @module infra/ratelimit/config
 */

import { API_ROUTES } from "@/shared/api/routes"

export interface RouteRateLimit {
  /** Max requests per IP per `windowMs`. */
  max: number
  /** Window duration in milliseconds. */
  windowMs: number
  /**
   * Predicate over the request pathname. Return true if this rule applies.
   * Order matters — first-match wins.
   */
  test: (pathname: string) => boolean
  /** Human-readable label for logs and the 429 body. */
  label: string
}

export const RATE_LIMITS: readonly RouteRateLimit[] = [
  // ─── Auth (Task 19) ────────────────────────────────────────────────────
  // Login attempts — 10 / 5 min / IP.
  {
    max: 10,
    windowMs: 5 * 60_000,
    test: pathname => pathname.startsWith("/api/auth/callback/"),
    label: "auth-callback",
  },

  // Signin page handler — 20 / 1 min / IP.
  {
    max: 20,
    windowMs: 60_000,
    test: pathname => pathname.startsWith("/api/auth/signin"),
    label: "auth-signin",
  },

  // ─── Codegen / file-write endpoints (Task B4) ──────────────────────────
  //
  // Each endpoint here writes source files or runtime config to disk. A
  // compromised admin token could be used to:
  //   - Fill the disk by spamming generate calls (each writes ~7 files).
  //   - Trigger continuous CI rebuilds (every write changes tracked source).
  //   - Burn typecheck-sandbox quota (each generate spins a tsc subprocess).
  //
  // The caps are tight on purpose: a real admin builds an entity at human
  // pace (one or two per minute, at peak). 5–10 / minute is enough for
  // genuine work and small enough that a hijacked token can't sustain a
  // dangerous write rate. Runtime-data writes get a higher cap (30/min)
  // because they're per-record CRUD, not codegen.

  // Entity-builder generate — 5 / 1 min / IP. Writes ~7 source files +
  // i18n bundles + runs init-entities + eslint --fix per call.
  {
    max: 5,
    windowMs: 60_000,
    test: pathname => pathname.startsWith(API_ROUTES.entityBuilder.generate),
    label: "codegen-entity",
  },

  // Widget-builder generate — 5 / 1 min / IP. Same blast radius shape:
  // writes a draft + (in runtime mode) the .widget.ts source file.
  {
    max: 5,
    windowMs: 60_000,
    test: pathname => pathname.startsWith(API_ROUTES.widgetBuilder.generate),
    label: "codegen-widget",
  },

  // Runtime-builder materialize — 10 / 1 min / IP. Promotes a runtime
  // entity to source files; goes through the same persistGeneration
  // pipeline as the entity builder. Slightly higher cap because dryRun
  // previews count against it (the UI hits this twice for every commit).
  {
    max: 10,
    windowMs: 60_000,
    test: pathname => pathname.startsWith(API_ROUTES.runtime.materializePrefix),
    label: "codegen-materialize",
  },

  // Runtime data writes — 30 / 1 min / IP. Per-record CRUD; an active
  // admin entering test data can easily exceed 5/min, so the cap is
  // higher. Still enough to flag a token-hijack burst (a real human
  // doesn't sustain 0.5/sec on a record form).
  {
    max: 30,
    windowMs: 60_000,
    test: pathname => pathname.startsWith(API_ROUTES.runtime.dataPrefix),
    label: "runtime-write",
  },

  // ─── Page-builder materialize (Phase 7) — 5 / 1 min / IP ───────────────
  // Tighter than CRUD: when implemented in Phase 7 this will write source
  // files via the same 7-gate pipeline as entity-builder (writes ~3 files
  // + bumps i18n + reruns init-entities). Listed BEFORE the CRUD rule so
  // the longer-prefix /materialize path matches first.
  {
    max: 5,
    windowMs: 60_000,
    test: pathname =>
      pathname.startsWith(API_ROUTES.pageBuilder.materializePrefix) && pathname.endsWith("/materialize"),
    label: "page-builder-materialize",
  },

  // ─── Page-builder CRUD (Task §15 Phase 6) — 30 / 1 min / IP ────────────
  // Per-record admin CRUD over saved page schemas. Generous enough for
  // legitimate canvas iteration (build → save → tweak → save) but small
  // enough that a hijacked token can't sustain a damaging write rate.
  {
    max: 30,
    windowMs: 60_000,
    test: pathname => pathname.startsWith(API_ROUTES.pageBuilder.pagesPrefix),
    label: "page-builder-crud",
  },

  // ─── Git bridge (admin runtime-codegen surface) — 10 / 1 min / IP ──────
  // The /api/admin/git/* endpoints can stage, commit, branch, and push to
  // the repo on behalf of the admin (gated by NODE_ENV !== production AND
  // the runtime-codegen flag AND the ADMIN_GIT_OPERATIONS permission —
  // see src/app/api/admin/git/_lib/gate.ts). Even with those gates a
  // hijacked admin session could otherwise spam commits, fill audit logs,
  // and trigger CI rebuild loops. 10/min is enough for any human admin
  // (the UI flow is dry-run → commit, ~2 calls per intent) but small
  // enough that a hijacked token can't sustain a damaging burst.
  {
    max: 10,
    windowMs: 60_000,
    test: pathname => pathname.startsWith("/api/admin/git/"),
    label: "admin-git",
  },

  // ─── Future endpoints — uncomment when each ships ──────────────────────
  //
  // /api/auth/forgot-password — 5 / 1 hour / IP. Each attempt sends mail.
  // /api/auth/register        — 5 / 1 hour / IP. Each creates an account.
  //
  // The matcher already covers them; only this table needs a new row.
] as const

/**
 * Find the first rate-limit rule that matches the given pathname, or null
 * if no rule applies.
 */
export function findRateLimit(pathname: string): RouteRateLimit | null {
  for (const limit of RATE_LIMITS) {
    if (limit.test(pathname)) return limit
  }
  return null
}
