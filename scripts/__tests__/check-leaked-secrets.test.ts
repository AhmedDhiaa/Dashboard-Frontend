/**
 * End-to-end test for `scripts/check-leaked-secrets.mjs`.
 *
 * The script reads the project root (`process.cwd() / __dirname`) for
 * `.env`, `.next/static/`, and `src/`, so the cleanest way to lock down
 * its behaviour is to copy it into a sandbox project, stage the relevant
 * fixture files, run it as a child process, and assert on the exit code
 * and stderr.
 *
 * Test matrix (one assertion per spec promise):
 *
 *   • clean fixture                                           → exit 0
 *   • bundle with AWS access key                              → exit 1
 *   • bundle with Google API key (no allowlist)               → exit 1
 *   • bundle with Google API key matching allowlist value     → exit 0
 *   • bundle with GitHub PAT                                  → exit 1
 *   • bundle with JWT-shaped string                           → exit 1
 *   • bundle with live OAUTH2_CLIENT_SECRET literal           → exit 1
 *   • source with NEXT_PUBLIC_FOO_SECRET                      → exit 1
 *   • source with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (allowed)   → exit 0
 *   • env file with previously-leaked AUTH_SECRET literal     → exit 1
 *   • no .next/static (fresh checkout)                        → exit 0 (skip)
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync, cpSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..", "..")
const SCRIPT_SRC = resolve(ROOT, "scripts", "check-leaked-secrets.mjs")

interface ScriptResult {
  status: number
  stdout: string
  stderr: string
}

let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "leaked-secrets-test-"))
  // Mirror the script under scripts/ so its `__dirname` resolution
  // (resolve(__dirname, "..")) lands on the sandbox root.
  mkdirSync(join(sandbox, "scripts"), { recursive: true })
  cpSync(SCRIPT_SRC, join(sandbox, "scripts", "check-leaked-secrets.mjs"))
  // Empty source tree by default — tests opt in to fixtures.
  mkdirSync(join(sandbox, "src"), { recursive: true })
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

function runScript(envOverrides: Record<string, string> = {}): ScriptResult {
  // Don't let the host machine's real secrets leak into the sandbox —
  // build the env from process.env, DELETE every secret-related var, then
  // re-apply only what the test explicitly overrode. Empty-string values
  // would trip the script's `process.env ?? fileEnv` short-circuit, so
  // deletion is mandatory (not just blanking).
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const k of ["AUTH_SECRET", "NEXTAUTH_SECRET", "OAUTH2_CLIENT_SECRET", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"]) {
    delete env[k]
  }
  Object.assign(env, envOverrides)

  try {
    const stdout = execFileSync("node", ["scripts/check-leaked-secrets.mjs"], {
      cwd: sandbox,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env,
    })
    return { status: 0, stdout, stderr: "" }
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return { status: e.status ?? -1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" }
  }
}

function writeBundle(name: string, contents: string): void {
  const dir = join(sandbox, ".next", "static", "chunks")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), contents)
}

function writeSource(rel: string, contents: string): void {
  const file = join(sandbox, "src", rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, contents)
}

function writeEnvFile(contents: string): void {
  writeFileSync(join(sandbox, ".env"), contents)
}

// ─── Clean tree + skip behaviour ────────────────────────────────────────────

describe("scanner — happy paths", () => {
  it("passes on a clean tree (no .env, no .next, no src files)", () => {
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
    expect(r.stdout).toMatch(/Env value deny list/)
    expect(r.stdout).toMatch(/skipped \(no \.next\/static/)
    expect(r.stdout).toMatch(/no secret-shaped names/)
  })

  it("inspects bundle files when .next/static exists", () => {
    writeBundle("clean.js", "console.log('hello')")
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
    expect(r.stdout).toMatch(/1 file\(s\) inspected/)
  })
})

// ─── Scan 1: env value deny list ────────────────────────────────────────────

describe("scanner — env value deny list", () => {
  it("FAILS when AUTH_SECRET matches the placeholder", () => {
    writeEnvFile("AUTH_SECRET=your-secret-here-minimum-32-chars\n")
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/AUTH_SECRET/)
  })

  it("passes when AUTH_SECRET is set to anything else", () => {
    writeEnvFile("AUTH_SECRET=01234567890123456789012345678901abc\n")
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })
})

// ─── Scan 2: client bundle pattern matching ─────────────────────────────────

describe("scanner — client bundle secret patterns", () => {
  it("FAILS on an AWS access key in a bundle", () => {
    writeBundle("aws.js", "const k = 'AKIAIOSFODNN7EXAMPLE'")
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/AWS access key/)
  })

  // Real Google API keys are exactly AIza + 35 base64url-safe chars =
  // 39 chars total. Synthetic test fixtures use the same shape so the
  // regex match equals the full string (otherwise the allowlist
  // comparison below would mismatch on a truncated prefix).
  const FAKE_GOOGLE_KEY = "AIzaABCDEFGHIJKLMNOPQRSTUVWXYZ123456789"

  it("FAILS on a Google API key in a bundle", () => {
    writeBundle("google.js", `config.apiKey = '${FAKE_GOOGLE_KEY}'`)
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Google API key/)
  })

  it("ALLOWS a Google API key that matches NEXT_PUBLIC_GOOGLE_MAPS_API_KEY's value", () => {
    writeBundle("google.js", `config.apiKey = '${FAKE_GOOGLE_KEY}'`)
    const r = runScript({ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: FAKE_GOOGLE_KEY })
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("FAILS on a GitHub personal access token", () => {
    // ghp_ + 36 chars.
    writeBundle("gh.js", "token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'")
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/GitHub personal token/)
  })

  it("FAILS on a JWT-shaped string", () => {
    // Three substantive base64url segments (each >= 20 chars).
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
      ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ" +
      ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    writeBundle("jwt.js", `const t = "${jwt}"`)
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/JWT-shaped string/)
  })

  it("does NOT flag short JWT-like fixtures (< 20 chars per segment)", () => {
    writeBundle("short.js", `const t = "eyJ.eyJ.x"`)
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("FAILS on the live OAUTH2_CLIENT_SECRET literal appearing in a bundle", () => {
    const secret = "super-secret-oauth-value-32-chars-minimum"
    writeBundle("leak.js", `const s = "${secret}"`)
    const r = runScript({ OAUTH2_CLIENT_SECRET: secret })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/live OAUTH2_CLIENT_SECRET value/)
  })

  it("ignores placeholder env values starting with 'your-'", () => {
    // The script intentionally skips placeholder secrets so a fresh
    // checkout doesn't false-positive on every bundle.
    const placeholder = "your-secret-here-minimum-32-chars"
    writeBundle("leak.js", `const s = "${placeholder}"`)
    const r = runScript({ OAUTH2_CLIENT_SECRET: placeholder })
    // The env-deny scan would already trip on this placeholder if it
    // was set to one of the deny-listed AUTH_SECRET values, but
    // OAUTH2_CLIENT_SECRET has no deny-list entries, so this passes.
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })
})

// ─── Scan 3: source NEXT_PUBLIC_* name scan ────────────────────────────────

describe("scanner — NEXT_PUBLIC_* name scan", () => {
  it("FAILS on NEXT_PUBLIC_FOO_SECRET in source", () => {
    writeSource("config.ts", `export const x = process.env.NEXT_PUBLIC_FOO_SECRET ?? ""\n`)
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/NEXT_PUBLIC_FOO_SECRET/)
  })

  it("FAILS on NEXT_PUBLIC_BAR_KEY", () => {
    writeSource("a.ts", `process.env.NEXT_PUBLIC_BAR_KEY`)
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/NEXT_PUBLIC_BAR_KEY/)
  })

  it("FAILS on NEXT_PUBLIC_FOO_PASSWORD", () => {
    writeSource("a.ts", `process.env.NEXT_PUBLIC_FOO_PASSWORD`)
    const r = runScript()
    expect(r.status).toBe(1)
  })

  it("FAILS on NEXT_PUBLIC_API_TOKEN", () => {
    writeSource("a.ts", `process.env.NEXT_PUBLIC_API_TOKEN`)
    const r = runScript()
    expect(r.status).toBe(1)
  })

  it("ALLOWS NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (documented public)", () => {
    writeSource("maps.ts", `const k = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY\n`)
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("ignores names without secret-y substrings", () => {
    writeSource("a.ts", `process.env.NEXT_PUBLIC_API_URL\nprocess.env.NEXT_PUBLIC_ENABLE_CHAT\n`)
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("ignores hits inside __tests__ directories", () => {
    writeSource("__tests__/foo.test.ts", `process.env.NEXT_PUBLIC_FOO_SECRET`)
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })
})
