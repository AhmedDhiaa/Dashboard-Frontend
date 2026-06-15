/**
 * Ambient declarations for optional peer dependencies of the rate-limit
 * module.
 *
 * `@upstash/redis` and `ioredis` are dynamic-imported at runtime in
 * `index.ts` and only loaded when the matching env var is set. They
 * intentionally aren't in `package.json` — production picks one and
 * installs it; dev / single-process deployments install neither and
 * use the in-memory fallback.
 *
 * Without these shims `tsc --noEmit` fails on the dynamic `await
 * import("@upstash/redis" | "ioredis")` lines because TS can't find the
 * module declarations. The shims supply minimal `any`-typed stand-ins
 * so the project type-checks cleanly whether the packages are installed
 * or not. When the real package IS installed, its own types take
 * precedence — these stubs only fill the gap when it isn't.
 */

declare module "@upstash/redis" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Redis: new (cfg: { url: string; token: string }) => any
}

declare module "ioredis" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Redis: new (url: string) => any
  export default Redis
}
