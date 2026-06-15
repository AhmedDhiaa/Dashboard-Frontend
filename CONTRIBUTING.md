# Contributing Guidelines

## 1. Developer Onboarding

1. **Setup**: Run `npm install` and `setup-env`.
2. **Sync**: Run `npm run init-entities` to ensure your registry is up to date.
3. **Verify**: Run `npm run quality` to ensure a clean baseline.

## 2. Technical Standards

### Zero-Tolerance for `any`
We use strictly typed TypeScript. If you encounter an external library with missing types, define a local `.d.ts` or use a type guard. **`as any` will fail CI.**

### Layer Boundaries
Respect the layers defined in `ARCHITECTURE.md`. 
- **Infra** cannot import from **UI**.
- **Core** cannot import from **Features**.
- Use absolute paths (e.g., `@/core/...`) for all imports.

### Design Tokens
Never use hardcoded hex codes or pixel values. Use the Tailwind variable system or project constants:
```tsx
// ❌ Incorrect
<div className="bg-[#f0f0f0] p-4" />

// ✅ Correct
<div className="bg-background-secondary p-spacing-md" />
```

## 3. Quality Suite

Always run the quality suite before pushing:
```bash
npm run quality
```
This runs:
- `type-check`: Strong typing verification.
- `lint`: Visual and architectural style checks.
- `validate`: Deep import-graph analysis.

## 4. Dependency Policy

### No prerelease dependencies (alpha / beta / rc / canary / etc.) by default

Beta and pre-release packages ship breaking changes between revisions and have caused production incidents in this codebase before (see `scripts/check-next-auth-pin.mjs` for the lesson). The default answer to *"can we install `library@1.0.0-beta.5`?"* is **no**.

If a prerelease is genuinely necessary — typically because no stable release exists yet for a feature you depend on — the path is:

1. **Pin exact** in `package.json`. No caret, no tilde. The version must not move silently.
2. **Add an entry** to `scripts/prerelease-deps-allowlist.json`:
   ```json
   {
     "package": "<name>",
     "version": "<exact pinned version>",
     "reason": "<why a stable release isn't acceptable + your rollback path>",
     "approver": "<your name / team>",
     "added": "YYYY-MM-DD"
   }
   ```
3. **Reference the entry** in your PR description. Sign-off is the PR review.
4. **Drop the entry** when the package upgrades to stable. The check script catches stale allowlist entries and tells you to remove them — this is intentional pressure to keep the list short.

CI runs `npm run check:prerelease-deps` on every PR. It fails on any prerelease in `dependencies` / `devDependencies` not in the allowlist, or on a version mismatch between the allowlist and `package.json`.

The check recognizes these prerelease tags: `alpha`, `beta`, `rc`, `pre`, `canary`, `next`, `experimental`, `insiders`, `nightly`.

## 5. Feature Workflows

For detailed instructions on creating new modules, see the **[Development Guide](docs/DEVELOPMENT.md)**.
