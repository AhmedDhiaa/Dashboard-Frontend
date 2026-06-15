/**
 * Shared gate for source-writing codegen routes.
 *
 * The entity-builder `generate`, widget-builder `generate`, runtime
 * `materialize`, and snapshot-`restore` routes can write into `src/` and spawn
 * `npm`/`eslint`. Those branches must NEVER run in a production build, even if
 * `APP_ALLOW_RUNTIME_CODEGEN` is set — this is belt-and-braces alongside:
 *
 *   • the startup safeguard (instrumentation → runtime-codegen-flag.ts), which
 *     refuses to boot a prod server with the flag on (absent an override token),
 *   • the git-bridge gate (admin/git/_lib/gate.ts) and the entity-converter
 *     convert/restore routes, which already 404 in production.
 *
 * Those routes already defended in depth; the entity-builder / widget-builder /
 * runtime-materialize routes only checked the env flag, so a builder-permission
 * holder could reach the source-write path on a prod box if the startup
 * override token had been used. `codegenAllowed()` closes that gap.
 *
 * Note: schema/widget DRAFTS (JSON under `messages/_overrides`) remain available
 * in production — only the branch that writes into `src/` is gated, so callers
 * keep their existing draft-fallback behaviour.
 */
const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

/** True only when the codegen flag is on AND we are not in a production build. */
export function codegenAllowed(): boolean {
  return process.env[RUNTIME_GATE] === "true" && process.env.NODE_ENV !== "production"
}
