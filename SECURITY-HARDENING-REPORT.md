# Security & Dependency-Health Hardening Report

**Repository:** Dashboard-Frontend (Next.js 16 / React 19 / TypeScript, npm)
**Date:** 2026-06-17
**Scope:** Dependencies and configuration only. **No application source or behavior was changed.**
**Toolchain constraint:** `package-lock.json` regenerated and validated exclusively with **npm 10** (the CI/Node 22 major). Local dev runs Node 24 / npm 11; that npm major is **never** used to write the lockfile because the lock it produces is rejected by `npm ci` under npm 10.

---

## 1. Executive summary

| Metric | Before | After |
| --- | --- | --- |
| Prod vulnerabilities (critical / high) | 0 / 0 | **0 / 0** |
| Prod vulnerabilities (moderate) | 4 | **0** |
| Full-tree vulnerabilities (incl. dev) | 4 moderate | **0** |
| Deprecation warnings on `npm ci` | 8 | **7** |
| `engines` pin present | no | **yes (Node 22, npm 10)** |
| `.nvmrc` present | no | **yes (`22`)** |
| Automated dependency updates | none | **Renovate** |
| CI prod-audit gate | advisory (`continue-on-error: true`) | **blocking** |

No high or critical vulnerabilities existed in production at any point; the four moderates
were nonetheless fully eliminated with two minimal, behavior-preserving `overrides`.

---

## 2. Vulnerability remediation

### 2.1 Inventory (before)

Captured with `npm audit` and `npm audit --omit=dev` (identical results — all four advisories
live in the production tree):

| Package | Severity | Advisory | Path | Why flagged |
| --- | --- | --- | --- | --- |
| `postcss` 8.4.31 | moderate | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) (XSS via unescaped `</style>` in CSS stringify, CVSS 6.1, range `<8.5.10`) | `next > postcss` (nested 8.4.31) | next@16 bundled an old nested postcss |
| `next` 16.2.6 | moderate | — | root | only surfaced as the **parent** of the postcss advisory; npm's only "fix" was an absurd downgrade to next@9.3.3 |
| `uuid` 8.3.2 | moderate | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) (missing buffer bounds check in v3/v5/v6 when `buf` provided, range `<11.1.1`) | `exceljs > uuid` | exceljs depends on `uuid@^8.3.0` |
| `exceljs` 4.4.0 | moderate | — | root | only surfaced as the **parent** of the uuid advisory; npm's only "fix" was a downgrade to exceljs@3.4.0 |

`npm audit fix --force` was **not** used: its proposed "fixes" were major **downgrades**
(next→9.3.3, exceljs→3.4.0) that would have broken the application.

### 2.2 Fixes applied (minimal, override-based)

Both root advisories (`postcss`, `uuid`) are transitive; npm `overrides` pin them to safe
versions without touching the parents' declared ranges.

| Change | From → To | Rationale | Verification |
| --- | --- | --- | --- |
| `overrides.postcss` = `"$postcss"` + bump direct devDep `postcss` `^8.5` → `^8.5.15` | next's nested postcss 8.4.31 → **8.5.15** | 8.4→8.5 is a backward-compatible minor; `$postcss` dedupes the whole tree to the single direct version, eliminating the vulnerable nested copy. A plain `"postcss": "^8.5.15"` override was rejected with `EOVERRIDE` because postcss is also a direct dependency — `$postcss` resolves that conflict. | `npm audit` → advisory gone; postcss resolves to a single 8.5.15 in the lock; build + tests green |
| `overrides.uuid` = `"^11.1.1"` | exceljs's uuid 8.3.2 → **11.1.1** | exceljs imports only `require('uuid').v4` (one site: `lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`); the `v4` named export is CJS-compatible across uuid 8→11, so the override is API-safe. The advisory's vulnerable path (v3/v5/v6 *with* `buf`) is **not reachable** through exceljs at all — the override is defense-in-depth that also clears the advisory and a deprecation warning. | `npm audit` → advisory gone; `vitest` (incl. any exceljs export tests) green |

### 2.3 Result (after)

```
npm audit --omit=dev            → 0 vulnerabilities (info/low/moderate/high/critical all 0)
npm audit                       → 0 vulnerabilities
npm audit --omit=dev --audit-level=high → "found 0 vulnerabilities", exit 0
```

**Residual vulnerabilities: none.**

---

## 3. Deprecated-dependency reduction

Deprecation warnings are emitted by `npm ci`. Captured before/after:

### 3.1 Addressed

| Deprecated package | Source | Action | Status |
| --- | --- | --- | --- |
| `uuid@8.3.2` | `exceljs` (prod) | Pinned to `uuid@11.1.1` via override (see §2.2) | **Removed** |

### 3.2 Remaining (with reasons — intentionally not chased)

All remaining deprecations are **transitive** with no safe, behavior-preserving fix available.
None is flagged by `npm audit` (no active advisory).

| Deprecated package | Brought in by | Type | Why not fixed |
| --- | --- | --- | --- |
| `glob@7.2.3` | `exceljs` → `archiver-utils`, `zip-stream`, `rimraf` | prod (transitive) | Forcing glob ≥10 would break these consumers — glob 9+ dropped the callback API that archiver-utils/rimraf@2 use. exceljs@4.4.0 is the latest release; upstream has not updated. |
| `inflight@1.0.6` | `glob@7` (via exceljs cluster) | prod (transitive) | Disappears only when glob is upgraded to ≥9; blocked by the glob constraint above. |
| `fstream@1.0.12` | `exceljs` → `unzipper` | prod (transitive) | No maintained drop-in; only reachable via exceljs's unzip path. No upstream fix. |
| `rimraf@2.7.1` | `exceljs` → `fstream` | prod (transitive) | Same exceljs/fstream chain; forcing rimraf@4+ changes its API and would break fstream. |
| `lodash.isequal@4.5.0` | `exceljs` → `fast-csv` → `@fast-csv/format` | prod (transitive) | Replacement is `node:util.isDeepStrictEqual`, a *code* change inside fast-csv — not ours to make. No upstream release adopts it yet. |
| `git-raw-commits@3.0.0` | `commit-and-tag-version` → `conventional-changelog-core`/`conventional-recommended-bump` | **dev** (release tooling) | Dev-only, runs only during `npm run release`. `commit-and-tag-version@12.7.3` is the latest; the deprecated nested version is its own pinned transitive. Zero runtime/shipping impact. |
| `git-semver-tags@5.0.1` | `commit-and-tag-version` | **dev** (release tooling) | Same as above — dev-only, latest parent, no shipped surface. |

**Net:** deprecations on `npm ci` reduced from **8 → 7**. The entire prod remainder originates
from `exceljs@4.4.0` (an unmaintained transitive cluster); a future major of exceljs — or
replacing it — is the only clean removal, tracked for Renovate's major-update dashboard.

---

## 4. Node / npm version pinning

Added to `package.json`:

```json
"engines": { "node": ">=22 <23", "npm": ">=10 <11" }
```

Added `.nvmrc`:

```
22
```

**Consistency check (all aligned on Node 22):**

| Surface | Node version | Status |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `NODE_VERSION: "22"` | ✅ already 22 |
| `.github/workflows/release.yml` | `NODE_VERSION: "22"` | ✅ already 22 |
| `Dockerfile` (deps/build/runner) | `node:22-alpine` | ✅ already 22 |
| `.github/workflows/{deploy-production,pr-preview,docker-publish,codeql}.yml` | no Node setup (Docker-based or CodeQL default) | ✅ nothing to pin |
| `@types/node` devDep | `~22.18.0` | ✅ already matches Node 22 |

No inconsistencies found; the pins **document** the existing contract rather than change it.

### `engine-strict` decision: **NOT enabled** (advisory pins only)

`engine-strict=true` (in `.npmrc`) makes npm **hard-fail** installs when `engines` is not
satisfied. That was deliberately **not** added because:

- The maintainer's **local environment is Node 24 / npm 11**, which violates the `npm <11` pin.
  `engine-strict` would make `npm install` fail outright on the dev machine — a worse failure
  mode than the version-mismatch class we're trying to prevent.
- The real enforcement that matters — "the lockfile must be installable by CI's npm 10" — is
  already guaranteed by regenerating the lock with npm 10 and by CI running `npm ci` on Node 22.
- Advisory `engines` still **warns** on mismatch and is consumed by Renovate, `.nvmrc`, and CI
  tooling, giving the documentation/automation benefit without breaking local dev.

---

## 5. Automated dependency updates — **Renovate** (`renovate.json`)

**Why Renovate over Dependabot:** the requirement is *grouped, scheduled updates with
conservative automerge (patch/minor of devDeps only)*. Renovate expresses all of that
declaratively in a single, auditable file. Dependabot cannot automerge from its own config —
it needs an additional write-enabled GitHub Actions workflow to call `gh pr merge --auto`,
which adds a privileged surface (counter-productive for a security-hardening task). Renovate
also gates automerge behind its own passing checks and adds OSV/vulnerability alerting and
lockfile maintenance.

Key configuration:

- **Managers:** npm + GitHub Actions (both via `config:recommended`).
- **Schedule:** weekly (`before 6am on monday`); lockfile maintenance monthly.
- **Grouping:** devDependencies (non-major), production dependencies (non-major), and
  github-actions are each grouped into single PRs.
- **Conservative automerge:** **only** patch/minor of **devDependencies** and non-major
  GitHub Actions auto-merge (via platform automerge). Production deps are grouped but require
  **manual** merge. **All major updates** require dashboard approval and never automerge.
- **Supply-chain guards:** `minimumReleaseAge: 3 days` (skips brand-new, potentially
  compromised releases); `ignoreUnstable` (from recommended) avoids prereleases, honoring the
  `check:prerelease-deps` gate.
- **Project-specific guards:**
  - `next-auth` updates **disabled** — it is pinned to an exact v5 beta and protected by the
    `check:next-auth-pin` quality gate.
  - `@types/node` constrained to `<23` to stay aligned with the Node 22 pin.
  - `engines` updates **disabled** so automation never moves the Node/npm pin.

Validated with `renovate-config-validator` (see acceptance §7) and as JSON.

---

## 6. CI audit gate — now blocking

In `.github/workflows/ci.yml` the production audit step previously had
`continue-on-error: true` (advisory). Because production high/critical count is **zero**, the
step is now **blocking**:

```yaml
- name: Dependency audit (prod, high+ severity)
  run: npm audit --omit=dev --audit-level=high
```

`--audit-level=high` means the build fails only on **high or critical** prod advisories
(moderate-and-below stay non-blocking, matching the original intent). `--omit=dev` keeps
devDependency advisories out of the gate since they never ship to users.

---

## 7. Acceptance criteria — commands & results

| # | Command | Required | Result |
| --- | --- | --- | --- |
| 1 | `npx -y npm@10 ci --include=dev --ignore-scripts` | exit 0 | ✅ exit 0 (lockfileVersion 3, npm-10-generated) |
| 2 | `npm audit --omit=dev --audit-level=high` | exit 0 | ✅ "found 0 vulnerabilities", exit 0 |
| 3 | `npm run quality` | passes (11 gates) | ✅ exit 0 — all 11 gates green (i18n parity 19×853, rsc-boundaries 0 violations, swagger-drift OK, color-fn OK, etc.) |
| 4 | `npx vitest run` | all pass | ✅ **1613 passed / 0 failed** across 153 test files |
| 5 | `npx next build --webpack` (and with `NEXT_PUBLIC_API_URL=""`) | succeeds | ✅ both exit 0 — "✓ Compiled successfully", 44/44 static pages generated in each run |
| 6 | `engines` + `.nvmrc` consistent with CI/Docker (Node 22) | present | ✅ see §4 |
| 7 | Renovate config present & valid | valid | ✅ valid JSON + `renovate-config-validator`: "Config validated successfully against 1 file(s)" |
| 8 | `SECURITY-HARDENING-REPORT.md` | written | ✅ this file |

All eight acceptance criteria pass.

---

## 8. Complete list of dependency/config changes

| File | Change | Justification |
| --- | --- | --- |
| `package.json` | devDep `postcss` `^8.5` → `^8.5.15` | Minor bump so `$postcss` override has a safe floor (≥8.5.10 fixes GHSA-qx2v-qp2m-jg93). |
| `package.json` | add `overrides.postcss` = `"$postcss"` | Dedupe whole tree (incl. next's nested 8.4.31) to the single safe direct version. |
| `package.json` | add `overrides.uuid` = `"^11.1.1"` | Eliminate GHSA-w5hq-g745-h8pq and the `uuid@8.3.2` deprecation; API-safe for exceljs. |
| `package.json` | add `engines` (Node `>=22 <23`, npm `>=10 <11`) | Pin the supported toolchain; prevent the npm-major lockfile-mismatch failure class. |
| `package-lock.json` | regenerated via **npm 10** | postcss→8.5.15, uuid→11.1.1; npm-10-compatible (validated with real `npm ci`). |
| `.nvmrc` | new, `22` | nvm/CI auto-select Node 22. |
| `renovate.json` | new | Automated, grouped, conservatively-automerged dependency updates + vuln alerts. |
| `.github/workflows/ci.yml` | prod audit step made blocking (removed `continue-on-error: true`) | Enforce zero high/critical prod advisories going forward. |

## 9. Residual-risk notes

- **Vulnerabilities:** none (0/0/0/0/0).
- **Deprecations:** 7 transitive remain (§3.2); 6 stem from `exceljs@4.4.0`'s archiver/unzip/
  fast-csv cluster (no upstream fix; majors would break Excel export — explicitly out of scope
  as a behavior change), 2 from dev-only release tooling. None has an active security advisory.
  Tracked for review via Renovate's major-update dashboard.
- **engine-strict:** intentionally advisory (§4) to avoid breaking the Node 24 / npm 11 dev box;
  the lockfile-major contract is enforced by CI's `npm ci` on Node 22 instead.

---

## 10. Supply-chain completions (follow-up)

Added on top of the core remediation to round the posture out to a world-class
supply-chain standard. All are additive and carry **zero CI-failure risk** (no
existing workflow logic was changed):

| Item | Change | Why |
| --- | --- | --- |
| **Vulnerability-disclosure policy** | New `SECURITY.md` | Standard for a serious repo: a private reporting channel (GitHub Security Advisories), supported-version statement, scope, and the documented security posture. |
| **SBOM (CycloneDX)** | New `npm run sbom` script (`npm sbom --sbom-format cyclonedx --omit dev`) + gitignored output | On-demand, machine-readable bill of materials of the **production** tree (verified: 361 components, CycloneDX 1.5). Enables downstream vulnerability/license correlation. |
| **GitHub Actions pinned to SHA** | `renovate.json` → `extends: helpers:pinGitHubActionDigests` | Actions were referenced by mutable tags (`@v4`). Renovate now opens a PR converting each to an immutable commit SHA (with the tag as a comment) and keeps the digest updated — closing a tag-hijack supply-chain vector without manual SHA lookups. |

**Verification:** `npm run sbom` → exit 0 + valid CycloneDX; `renovate.json` and
`package.json` remain valid JSON. No application code, build, lint, or test
behavior was touched.
