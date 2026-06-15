/**
 * Coverage for the append-only generation audit log. Audit is best-effort
 * (a failed write must not break the generation it audits), so the tests
 * pin both the happy path and the error-swallow contract.
 */

import { mkdtempSync, readFileSync, rmSync, statSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { EntityBuilderSchema } from "../../types/builder-schema"

const ORIGINAL_CWD = process.cwd()
let sandbox: string

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "audit-test-"))
  process.chdir(sandbox)
  vi.resetModules()
})

afterEach(() => {
  process.chdir(ORIGINAL_CWD)
  rmSync(sandbox, { recursive: true, force: true })
  vi.restoreAllMocks()
})

async function load() {
  return await import("../audit")
}

function auditFilePath(): string {
  return join(sandbox, "messages", "_overrides", "entity-builder", "_audit.jsonl")
}

const MIN_SCHEMA: EntityBuilderSchema = {
  entityName: "customer",
  domain: "business",
  endpoint: "/api/app/customer",
  permissionKey: "Api.Customer",
  fields: [],
} as unknown as EntityBuilderSchema

describe("hashSchema", () => {
  it("returns a 16-char sha256 prefix that's stable across calls", async () => {
    const { hashSchema } = await load()
    const a = hashSchema(MIN_SCHEMA)
    const b = hashSchema(MIN_SCHEMA)
    expect(a).toMatch(/^[a-f0-9]{16}$/)
    expect(a).toBe(b)
  })

  it("produces a different hash when the schema changes", async () => {
    const { hashSchema } = await load()
    const a = hashSchema(MIN_SCHEMA)
    const b = hashSchema({ ...MIN_SCHEMA, entityName: "supplier" } as unknown as EntityBuilderSchema)
    expect(a).not.toBe(b)
  })
})

describe("appendAudit", () => {
  it("creates the directory and writes one JSONL line per call", async () => {
    const { appendAudit } = await load()
    const entry = {
      timestamp: "2026-01-01T00:00:00Z",
      actor: "alice@example.com",
      entityName: "customer",
      schemaHash: "abcdef0123456789",
      outcome: "success" as const,
      filesWritten: 7,
      warnings: 0,
      error: null,
    }
    await appendAudit(entry)
    await appendAudit({ ...entry, outcome: "failure", error: "boom" })

    const raw = readFileSync(auditFilePath(), "utf8")
    const lines = raw.trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]!)).toEqual(entry)
    expect(JSON.parse(lines[1]!).outcome).toBe("failure")
    expect(JSON.parse(lines[1]!).error).toBe("boom")
  })

  it("appends to a pre-existing audit file rather than truncating it", async () => {
    // Pre-seed a partial file as if a prior generation already audited.
    const dir = join(sandbox, "messages", "_overrides", "entity-builder")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "_audit.jsonl"), '{"prior":true}\n')

    const { appendAudit } = await load()
    await appendAudit({
      timestamp: "2026-01-01T00:00:00Z",
      actor: null,
      entityName: "customer",
      schemaHash: "0000000000000000",
      outcome: "success",
      filesWritten: 1,
      warnings: 0,
      error: null,
    })

    const lines = readFileSync(auditFilePath(), "utf8").trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]!)).toEqual({ prior: true })
  })

  it("swallows fs errors — a write failure must not throw past the helper", async () => {
    const { appendAudit } = await load()
    // Make the audit dir unwritable by creating it as a file at the parent
    // path so mkdir({recursive}) fails with EEXIST/ENOTDIR. This is the
    // simplest way to force the catch branch without monkey-patching fs.
    mkdirSync(join(sandbox, "messages", "_overrides"), { recursive: true })
    writeFileSync(join(sandbox, "messages", "_overrides", "entity-builder"), "i am a file")

    await expect(
      appendAudit({
        timestamp: "now",
        actor: null,
        entityName: "x",
        schemaHash: "0",
        outcome: "refused",
        filesWritten: 0,
        warnings: 0,
        error: null,
      }),
    ).resolves.toBeUndefined()

    // The pre-existing "i am a file" should still be a file (not converted
    // to a dir) — the failed mkdir didn't replace it.
    expect(statSync(join(sandbox, "messages", "_overrides", "entity-builder")).isFile()).toBe(true)
  })
})
