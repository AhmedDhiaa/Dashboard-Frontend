/**
 * Environment Variables — Zod-validated at startup
 * Import `env` from here instead of reading process.env directly.
 *
 * IMPORTANT: Validation only throws at RUNTIME (server start), never during
 * `next build`. Build-time page data collection must not fail on missing secrets.
 */

import { z } from "zod"

// Dev-only fallback — never used in production
const DEV_API_FALLBACK = process.env.NODE_ENV !== "production" ? "http://localhost:3000" : ""

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url("NEXT_PUBLIC_API_URL must be a valid URL").optional().default(DEV_API_FALLBACK),
  // Backend selector for the composition root: "abp" (default) or the reference
  // "rest" adapter. Mock mode (NEXT_PUBLIC_USE_MOCK_API) overrides this.
  NEXT_PUBLIC_BACKEND: z.enum(["abp", "rest"]).optional(),
  NEXT_PUBLIC_REST_API_URL: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  NEXT_PUBLIC_LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  NEXT_PUBLIC_LOG_ENDPOINT: z.string().optional(),
  NEXT_PUBLIC_SOCKET_URL: z.string().optional(),
  NEXT_PUBLIC_CLIENT_ID: z.string().optional(),
  // White-label brand identity — see src/shared/config/brand.ts.
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  NEXT_PUBLIC_BRAND_DOMAIN: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

export type Env = z.infer<typeof envSchema>

/**
 * Strict runtime schema — only enforced when explicitly called at server start.
 * Never runs during `next build`.
 *
 * In development, NEXT_PUBLIC_API_URL is optional (we fall back to localhost via
 * DEV_API_FALLBACK). In production it's required.
 */
const isProduction = process.env.NODE_ENV === "production"
const runtimeSchema = z
  .object({
    NEXT_PUBLIC_API_URL: isProduction
      ? z.string().url("NEXT_PUBLIC_API_URL must be a valid URL")
      : z.string().url("NEXT_PUBLIC_API_URL must be a valid URL").optional(),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars").optional(),
    NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 chars").optional(),
  })
  // In production NextAuth signs sessions with AUTH_SECRET / NEXTAUTH_SECRET.
  // Both being optional meant a prod boot with NO secret passed validation and
  // failed lazily deep inside NextAuth. Require at least one (≥32 chars) so the
  // server fails fast at startup instead.
  .superRefine((val, ctx) => {
    if (!isProduction) return
    const secret = val.AUTH_SECRET ?? val.NEXTAUTH_SECRET
    if (!secret || secret.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_SECRET"],
        message: "In production, AUTH_SECRET (or NEXTAUTH_SECRET) is required and must be at least 32 characters.",
      })
    }
  })

function parseEnv(): Env {
  // A Docker/CI build-arg that is declared but unset arrives as "" (not
  // undefined) — e.g. `--build-arg NEXT_PUBLIC_API_URL=`. An empty string
  // fails `.url()`, and `.optional()`/`.default()` only cover `undefined`,
  // so without this the `.parse()` below throws at module load and breaks
  // `next build` page-data collection. Fold "" → undefined so the
  // optional/default path applies and parsing never throws during a build.
  const source = {
    ...process.env,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
  }
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const errors = result.error.issues.map(e => `  ${e.path.join(".")}: ${e.message}`).join("\n")
    console.warn(`\n⚠️  Environment variable warnings:\n${errors}\n`)
    // Last-resort parse: force the API URL to the (dev) fallback or undefined
    // so module load never throws — build-time page-data collection depends
    // on this never failing.
    return envSchema.parse({ ...source, NEXT_PUBLIC_API_URL: DEV_API_FALLBACK || undefined })
  }
  return result.data
}

// Always safe — no throwing, no min-length checks at module load
export const env = parseEnv()

/**
 * Call this in server.ts / instrumentation.ts to enforce strict validation
 * at actual server startup (not during build).
 */
export function validateEnvironmentVariables(): void {
  const result = runtimeSchema.safeParse(process.env)
  if (!result.success) {
    const errors = result.error.issues.map(e => `  ${e.path.join(".")}: ${e.message}`).join("\n")
    const msg = `\n\n❌ Invalid environment variables:\n${errors}\n`
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg)
    } else {
      console.warn(msg)
    }
  }
}

// Legacy shape kept for backward compat with src/shared/config/app.ts
export const legacyEnv = {
  api: {
    baseUrl: env.NEXT_PUBLIC_API_URL,
    socketUrl: env.NEXT_PUBLIC_SOCKET_URL ?? "",
  },
  auth: {
    secret: env.AUTH_SECRET ?? env.NEXTAUTH_SECRET ?? "",
    url: env.NEXTAUTH_URL ?? "",
    clientId: env.NEXT_PUBLIC_CLIENT_ID ?? "",
  },
  maps: {
    googleApiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  },
  isDevelopment: env.NODE_ENV === "development",
  isProduction: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
} as const
