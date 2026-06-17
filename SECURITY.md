# Security Policy

## Supported versions

Security fixes are applied to the latest released version on the `main` branch.
Older tags are not maintained — please upgrade to the latest release.

| Version            | Supported          |
| ------------------ | ------------------ |
| Latest `main` / release | ✅ |
| Older tags         | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via **GitHub Security Advisories** — the
[“Report a vulnerability”](../../security/advisories/new) button on this
repository — or by email to the maintainer. Include:

- a description of the issue and its impact,
- steps to reproduce (or a proof-of-concept),
- affected version / commit, and any suggested remediation.

We aim to acknowledge a report within **72 hours** and to ship a fix or a
mitigation plan for confirmed high/critical issues as a priority. We will
credit reporters in the advisory unless you prefer to remain anonymous.

## What's in scope

This is a frontend application. The highest-value targets are:

- authentication / session handling (NextAuth + the ABP OAuth2 flow),
- the dev-only admin surfaces (git-bridge, runtime/entity/page/widget builders)
  and their server routes,
- any path that writes to disk or shells out, and
- secret handling and the build-time environment contract.

Out of scope: issues that require a misconfigured deployment (e.g. running the
dev-only admin tools in production with `NODE_ENV` unset), and findings in
third-party dependencies that already have an upstream advisory — those are
tracked automatically (see below).

## Our security posture

This project is hardened and continuously monitored:

- **Dependency audit gate** — CI fails on any **high/critical** advisory in
  production dependencies (`npm audit --omit=dev --audit-level=high`).
- **Automated updates & alerts** — Renovate keeps dependencies and GitHub
  Actions current (Actions are pinned to commit SHAs), with OSV/vulnerability
  alerting and a 3-day minimum release age to dodge compromised fresh releases.
- **SBOM** — a CycloneDX Software Bill of Materials can be produced at any time
  with `npm run sbom` (production tree).
- **Secret scanning** — `npm run check:leaked-secrets` scans the client bundle
  and env files on every build; CI re-checks the produced bundle.
- **Strict CSP** — production responses ship a per-request nonce-based
  `Content-Security-Policy` (no `'unsafe-inline'` for scripts).
- **Pinned auth dependency** — `next-auth` is pinned exactly and guarded by a
  dedicated CI check (`check:next-auth-pin`).
- **Reproducible installs** — the toolchain is pinned (Node 22 / npm 10 via
  `engines` + `.nvmrc`) and CI installs with `npm ci`.

See [`SECURITY-HARDENING-REPORT.md`](SECURITY-HARDENING-REPORT.md) for the full
dependency-health audit and remediation record.
