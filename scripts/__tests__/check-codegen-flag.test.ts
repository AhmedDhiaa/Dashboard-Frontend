/**
 * End-to-end test for `scripts/check-codegen-flag.mjs`.
 *
 * The script enumerates env files via `git ls-files`, so a unit test that
 * just imports it can't exercise the real path. Instead, we drive the
 * script as a child process inside a throwaway git worktree where we
 * stage a fixture `.env.malicious` file. The script's exit code tells us
 * whether the guard fired.
 *
 * Test cases mirror the spec:
 *   • clean tree                              → exit 0
 *   • tracked file with FLAG=true             → exit 1
 *   • tracked file with OVERRIDE=token        → exit 1
 *   • tracked file with both                  → exit 1
 *   • untracked file with both                → exit 0 (script ignores)
 *   • commented-out FLAG=true                 → exit 0 (parser respects #)
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync, cpSync } from "node:fs"
import { execFileSync, execSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..", "..")
const SCRIPT = resolve(ROOT, "scripts", "check-codegen-flag.mjs")

interface SandboxResult {
  status: number
  stdout: string
  stderr: string
}

let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "codegen-flag-test-"))
  // Initialise an empty git repo so `git ls-files` works inside the
  // sandbox. We stage files explicitly per test; nothing is auto-added.
  execSync("git init --quiet -b main", { cwd: sandbox })
  execSync('git config user.email "test@example.com"', { cwd: sandbox })
  execSync('git config user.name "test"', { cwd: sandbox })
  // Windows hosts default to core.autocrlf=true, which makes `git add` print
  // "LF will be replaced by CRLF" warnings for the LF-normalised script/env
  // fixtures. Pin it off so the test output stays clean.
  execSync("git config core.autocrlf false", { cwd: sandbox })
  // Mirror the script under scripts/ — same relative path the real
  // package.json refers to.
  mkdirSync(join(sandbox, "scripts"), { recursive: true })
  cpSync(SCRIPT, join(sandbox, "scripts", "check-codegen-flag.mjs"))
  execSync("git add scripts", { cwd: sandbox })
  execSync('git commit --quiet -m "init"', { cwd: sandbox })
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

function runScript(): SandboxResult {
  try {
    const stdout = execFileSync("node", ["scripts/check-codegen-flag.mjs"], {
      cwd: sandbox,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { status: 0, stdout, stderr: "" }
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    return { status: e.status ?? -1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" }
  }
}

function commitEnvFile(name: string, contents: string): void {
  writeFileSync(join(sandbox, name), contents)
  execSync(`git add "${name}"`, { cwd: sandbox })
  execSync(`git commit --quiet -m "add ${name}"`, { cwd: sandbox })
}

describe("check:codegen-flag CI script", () => {
  it("passes on a clean tree (no env files tracked)", () => {
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
    expect(r.stdout).toMatch(/No tracked env file arms/)
  })

  it("passes when only an empty .env.example is tracked", () => {
    commitEnvFile(".env.example", "API_URL=https://example.com\n")
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("FAILS when a tracked file sets FLAG=true alone", () => {
    commitEnvFile(".env.production", "APP_ALLOW_RUNTIME_CODEGEN=true\n")
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/APP_ALLOW_RUNTIME_CODEGEN=true/)
  })

  it("FAILS when a tracked file sets the OVERRIDE alone", () => {
    commitEnvFile(".env.staging", "APP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE=i-understand-the-risks\n")
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/production override/i)
  })

  it("FAILS when a tracked file sets BOTH (the spec's primary trigger)", () => {
    commitEnvFile(
      ".env.production",
      "APP_ALLOW_RUNTIME_CODEGEN=true\nAPP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE=i-understand-the-risks\n",
    )
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/Arms the runtime-codegen flag AND its production override/)
  })

  it("ignores untracked .env files even when they hold the dangerous combo", () => {
    // Write the file but DO NOT commit it — git ls-files won't see it,
    // CI never considers it.
    writeFileSync(
      join(sandbox, ".env.local"),
      "APP_ALLOW_RUNTIME_CODEGEN=true\nAPP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE=i-understand-the-risks\n",
    )
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("ignores commented-out FLAG=true (env parser respects #)", () => {
    commitEnvFile(".env.example", "# APP_ALLOW_RUNTIME_CODEGEN=true\nAPI_URL=x\n")
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("treats FLAG=false as harmless", () => {
    commitEnvFile(".env.production", "APP_ALLOW_RUNTIME_CODEGEN=false\n")
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("treats OVERRIDE='true' (wrong token) as harmless", () => {
    commitEnvFile(".env.production", "APP_ALLOW_RUNTIME_CODEGEN_PROD_OVERRIDE=true\n")
    const r = runScript()
    expect(r.status, r.stderr || r.stdout).toBe(0)
  })

  it("flags multiple offending files in one run", () => {
    commitEnvFile(".env.production", "APP_ALLOW_RUNTIME_CODEGEN=true\n")
    commitEnvFile(".env.staging", "APP_ALLOW_RUNTIME_CODEGEN=true\n")
    const r = runScript()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/\.env\.production/)
    expect(r.stderr).toMatch(/\.env\.staging/)
  })
})
