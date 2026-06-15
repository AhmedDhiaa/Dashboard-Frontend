# Deploy & CD runbook

Walks Task E5: continuous-delivery to staging on every merge to main,
manual-only promotion to production, PR previews, and the branch-
protection rules that gate the whole flow.

## 1. Workflow overview

CI/CD is split into single-responsibility workflows. GitLab CI
([`.gitlab-ci.yml`](../../.gitlab-ci.yml)) mirrors the same stages for teams on
GitLab.

| Workflow | Trigger | Job graph | What it produces |
| --- | --- | --- | --- |
| [`ci.yml`](../../.github/workflows/ci.yml) | `push` to main, every PR | `quality` ∥ `test` → `build` | Quality-gate + test verdict, bundle-budget check, and the **portable publish bundle** (`dist/<name>-<version>.tar.gz`) as an artifact |
| [`docker-publish.yml`](../../.github/workflows/docker-publish.yml) | `push` to main / `v*` tags, PRs (build-only) | `image` → `deploy-staging` (main only) | Multi-arch image at `ghcr.io/<owner>/<repo>` (`:edge`, `:<semver>`, `:sha`), then a webhook deploy + `/api/health` smoke check to staging |
| [`deploy-production.yml`](../../.github/workflows/deploy-production.yml) | `workflow_dispatch` (manual) | `promote` | Re-tags a chosen image as `:production`, fires the prod webhook, smoke-checks `/api/health` |
| [`pr-preview.yml`](../../.github/workflows/pr-preview.yml) | `pull_request` (same-repo) | `preview` | Per-PR image `ghcr.io/<owner>/<repo>:pr-<number>` + sticky comment with the run command |
| [`release.yml`](../../.github/workflows/release.yml) | `v*` tags | `release` | Builds + attaches the portable publish bundle to a GitHub Release |
| [`codeql.yml`](../../.github/workflows/codeql.yml) | push/PR to main, weekly | `analyze` | Static security analysis (Security tab) |

The **portable publish bundle** (`npm run publish:bundle`, packaged by
[`scripts/publish.mjs`](../../scripts/publish.mjs)) is the OS-agnostic deploy
artifact — the Next standalone server + assets + start scripts and
systemd/PM2/nginx/IIS configs under [`deploy/`](../../deploy/). See
[`deploy/README.md`](../../deploy/README.md) for running it on Linux, Windows,
IIS, or Docker.

## 2. Required status checks (branch-protection setup)

GitHub branch protection is configured in the repo settings, not in a
checked-in YAML. Walk this once per repo (and again whenever a job is
renamed):

1. **Settings → Branches → Branch protection rules → Add rule**.
2. **Branch name pattern**: `main`.
3. Enable **Require a pull request before merging** with at least 1
   approving review. (Stricter teams: require code-owner review for
   files under `src/infra/**`, `src/shared/auth/**`,
   `src/app/api/**`.)
4. Enable **Require status checks to pass before merging** and pick:
   - `quality`
   - `test`
   - `build`
   - `image` *(if the team wants every merge to also require a
     successful main-branch image build — note this only fires
     post-merge, so it can't be a pre-merge required check; leave it
     unrequired.)*

   **Don't** require `deploy-staging` — it runs post-merge. A failed
   staging deploy is investigated separately (see §6 below).
5. Enable **Require branches to be up to date before merging**. This
   forces a rebase against the latest main before the merge button
   becomes available, which catches the "two PRs both green
   independently, broken when combined" class of regressions.

## 3. Secrets and environment variables

### Repository-level secrets

| Name | Used by | What it is |
| --- | --- | --- |
| `NEXTAUTH_SECRET` | `ci.yml#build` | Build-time secret consumed by `next build` for static page generation. |
| `NEXTAUTH_URL` | `ci.yml#build` | Same — build-time only. |
| `STAGING_DEPLOY_HOOK` | `ci.yml#deploy-staging` | The team's deploy webhook (Render/Fly hook URL, an internal trigger endpoint, or substitute kubectl/flyctl creds — see the comments in the workflow). |
| `PRODUCTION_DEPLOY_HOOK` | `deploy-production.yml` | Same shape, production environment. |
| `GITHUB_TOKEN` | every workflow | Built-in. Pushes images to GHCR — no setup needed. |

Add platform-specific creds (`KUBECONFIG_B64`, `FLY_API_TOKEN`,
`AWS_ROLE_ARN`, etc.) under the matching `environment` so they're only
exposed to the deploy step that needs them — never as bare repo
secrets.

### Environment-level setup

In **Settings → Environments**, create:

#### `staging`
- **Deployment branches**: `main` only.
- **Environment URL** (variable, not secret): `STAGING_URL` =
  `https://app-staging.example.com`. The CI workflow puts this on the
  GitHub run UI so a "Deployed" link appears next to each successful
  push to main.
- **Required reviewers**: usually none — staging deploys should be
  automatic.
- **Wait timer**: 0.

#### `production`
- **Deployment branches**: `main` only.
- **Environment URL**: `PRODUCTION_URL` = `https://app.example.com`.
- **Required reviewers**: at least one (usually the on-call rotation).
  This is what makes "manual trigger only" actually manual — the
  `workflow_dispatch` won't promote to prod until a reviewer clicks
  approve in the run UI.
- **Wait timer**: 0 (the reviewer gate is the friction we want; an
  additional timer just slows incident response).

## 4. End-to-end flow for a typical PR

```
PR opened
  ├── ci.yml runs: quality ∥ test → build  (required for merge)
  └── pr-preview.yml runs: builds ghcr.io/.../pr-<number>-<sha>
      └── sticky comment lands on the PR with the pull command
                    │
                    │  (reviewer approves; merge button enabled)
                    │
PR merged to main
  └── ci.yml on push: quality ∥ test → build → image → deploy-staging
                                                            │
                                                            └── /api/health smoke check
                                                                  │
                                                                  ✓ staging green within ~5 min total
       │
       │  (later, when a release is wanted)
       │
Manual trigger: deploy-production.yml
  └── promote: verify image exists → re-tag :production → deploy → /api/health
       │
       │  (reviewer approves the `production` environment gate)
       │
       └── prod live, run summary shows the URL.
```

## 5. PR previews — hosted platform options

The CI-built image (`pr-preview.yml`) is the lowest-friction option:
every PR gets an image you can `docker run` locally. For a hosted
public URL, enable ONE of the following (UI/dashboard setup, not a
workflow file):

### Vercel
- Install the **Vercel** GitHub App on the repo.
- In Vercel project settings → Git, enable preview deployments for
  pull requests.
- Vercel auto-comments on each PR with the preview URL.
- Override `messages/_overrides/` to a per-deployment ephemeral path
  (the default). **Do NOT mount the production volume to previews.**

### Render
- Connect the repo as a Web Service.
- Service settings → Pull Request Previews → **Enabled**.
- Render comments on each PR with the preview URL.

### Fly.io
- `flyctl launch --copy-config` per branch via a small workflow step,
  or use Fly's GitHub Action (`superfly/flyctl-actions/setup-flyctl`)
  to deploy `pr-<number>` apps automatically. Set
  `[mounts] source = "preview-<pr>"` so previews don't share state
  with prod.

### Coolify / self-hosted
- Most self-hosted PaaSes have a "preview environment per branch"
  toggle. Point them at the GHCR image tag from `pr-preview.yml` so
  they don't rebuild the image themselves.

**Critical isolation rule** for any of the above: the
`messages/_overrides/` volume must be per-environment ephemeral.
Sharing the path across staging/production/preview is what would let a
runtime-builder edit on a preview leak into prod's user-visible
overrides. The Docker image's writable layer is already per-container
ephemeral; the only way to break isolation is to mount the same
external PVC / volume into multiple environments. **Don't.**

## 6. When staging is red after a merge to main

`deploy-staging` failing doesn't block the merge (it can't — it runs
post-merge). When it fails:

1. **Check `/api/health` against the staging URL.** If `backend: fail`,
   the upstream API is down — usually not the deploy's fault. If
   `storage: fail`, the staging volume isn't writable — check the
   mount in your orchestrator.
2. **Look at the deploy step's curl output** in the run log. Most
   webhook-based deploys return a 4xx on a misconfigured request body
   shape; the curl `--show-error` output is the fastest signal.
3. **Roll back by re-running the previous green deploy.** The image
   for the prior commit is still tagged in GHCR
   (`ghcr.io/<owner>/<repo>:<previous-sha>`); the staging deploy hook
   will pick it up.
4. **Fix forward, then re-merge.** Don't keep retrying the failing
   workflow against a broken commit — open a fix PR, get it green in
   CI, merge.

## 7. Performance budget (Done-when criterion)

The spec requires "merging to main automatically reaches staging in
<5 minutes with all checks green." The job durations on a warm cache
should be roughly:

| Job | Typical | What slows it down |
| --- | --- | --- |
| `quality` | 60-90 s | Big lint config changes; `validate` running over a freshly-rotated translation set. |
| `test` | 90-150 s | The vitest coverage run; ~700 tests today. |
| `build` | 90-150 s | `next build` — webpack tree-shaking is the slow path. |
| `image` | 30-60 s | First push of the day pays a layer-cache miss; subsequent pushes reuse `deps` and `build` stages. |
| `deploy-staging` | 30-60 s | The deploy hook + 25 s `/api/health` retry budget. |
| **Total** | **~5 min** | quality / test / build run in parallel; `image` and `deploy-staging` are sequential after `build`. |

If the total slips past 5 minutes consistently, the usual culprits
are: a bloated lockfile (`npm ci` taking 60+ s), tests added that hit
the network without mocking, or a Docker-cache miss because the
`COPY package*.json` layer changed unnecessarily. The runbook
[deploy-hygiene.md](./deploy-hygiene.md) §2 has the image-size and
boot-time benchmarks; if those drift, the deploy time follows.

## When to walk this list

- **Whenever you set up a new fork or rebuild the deploy infra.** §3
  (secrets) and §2 (branch protection) are the parts that don't live
  in the repo.
- **After renaming a job in `ci.yml`.** The required-checks list in
  §2 is keyed by job name; a rename without a branch-protection
  update silently makes the merge gate weaker.
- **After enabling a PR-preview platform.** Verify §5's isolation
  rule — that's the failure mode that matters.
