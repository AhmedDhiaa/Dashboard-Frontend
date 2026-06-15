/**
 * Round-trip gate for the two real registry files.
 *
 * Contract: an idempotent (no-op) patch — re-inserting an entry that
 * already exists — must produce a string byte-identical to the input.
 *
 * Prompt 6's experiment proved that print-the-whole-AST tools (ts-morph
 * / ts.printer) CANNOT survive this gate on this codebase. The text-
 * surgical patcher we ship here CAN, because the "no-op on existing
 * entry" path doesn't touch any bytes at all.
 *
 * This file is a CI gate: a regression in the patcher (e.g. a future
 * change that normalises whitespace before insertion) is what fails
 * this test.
 */

import { promises as fs } from "node:fs"
import { describe, expect, it } from "vitest"
import path from "node:path"
import { applyNavigationPatch } from "../navigation-patcher"
import { applyPermissionKeyPatch } from "../permission-keys-patcher"

const REPO_ROOT = process.cwd()

async function readFromDisk(rel: string): Promise<string> {
  return await fs.readFile(path.resolve(REPO_ROOT, rel), "utf8")
}

describe("permission-keys.ts round-trip (no-op patch ⇒ byte-identical)", () => {
  it("re-inserting an existing entry yields the original bytes", async () => {
    const original = await readFromDisk("src/shared/auth/permission-keys.ts")
    const r = applyPermissionKeyPatch(original, {
      identifier: "ADMIN_ENTITY_BUILDER",
      value: "Api.Admin.EntityBuilder",
    })
    expect(r.changed).toBe(false)
    expect(r.content).toBe(original)
  })

  it("re-inserting EVERY existing entry one-by-one preserves bytes after each", async () => {
    const original = await readFromDisk("src/shared/auth/permission-keys.ts")
    // Find every existing IDENT: "VALUE" pair via the same regex the patcher uses.
    const entryRe = /^\s+([A-Z][A-Z0-9_]*): "([^"]+)",\s*$/gm
    let m: RegExpExecArray | null
    const entries: Array<{ identifier: string; value: string }> = []
    while ((m = entryRe.exec(original)) !== null) entries.push({ identifier: m[1]!, value: m[2]! })
    expect(entries.length, "fixture sanity").toBeGreaterThan(5)

    let current = original
    for (const e of entries) {
      const r = applyPermissionKeyPatch(current, e)
      expect(r.changed, `re-inserting ${e.identifier} should be a no-op`).toBe(false)
      expect(r.content).toBe(original)
      current = r.content
    }
  })
})

describe("navigation.ts round-trip (no-op patch ⇒ byte-identical)", () => {
  it("re-inserting an existing top-level entry yields the original bytes", async () => {
    const original = await readFromDisk("src/shared/config/navigation.ts")
    // The dashboard entry is a known stable one-liner.
    const r = applyNavigationPatch(original, {
      group: "nav.overview",
      titleKey: "nav.dashboard",
      href: "/",
      requiredPermission: "PERMISSIONS.DASHBOARD_COUNT",
    })
    // Whether `r.changed` is false depends on whether the existing entry
    // matches our serialiser's emission exactly. The harder contract —
    // that an href COLLISION is detected even on no-op shape — is what
    // matters for the CI gate. We accept both: if changed=true we'd be
    // duplicating the entry, which the collision check refuses below.
    if (r.changed) {
      // The "/" href already exists; re-inserting must have thrown.
      throw new Error("expected the patcher to detect the existing href as a no-op or collision")
    }
    expect(r.content).toBe(original)
  })

  it("every existing href is detected as a collision against the live file", async () => {
    const original = await readFromDisk("src/shared/config/navigation.ts")
    // Sample of stable hrefs from each group. If a future PR removes one
    // of these, the test name surfaces what changed.
    const probes = ["/", "/example", "/tickets", "/users", "/notifications"]
    for (const href of probes) {
      // Same titleKey + href → no-op. Different titleKey + same href → collision.
      // We use the harder "different titleKey" case to ensure collision
      // detection works in production data.
      expect(() =>
        applyNavigationPatch(original, {
          group: "nav.overview",
          titleKey: "nav.does_not_match_anything_real",
          href,
        }),
      ).toThrowError(/already points to/)
    }
  })

  it("the parser sees the real file's groups (sanity for the group-detection regex)", async () => {
    const original = await readFromDisk("src/shared/config/navigation.ts")
    // Inserting into a known-existing group should succeed validation
    // (we'd get past the group lookup and into the insertion path).
    // Use a synthetic href that definitely doesn't exist to avoid
    // the collision short-circuit.
    const r = applyNavigationPatch(original, {
      group: "nav.operations",
      titleKey: "nav.synthetic_roundtrip_probe",
      href: "/synthetic-roundtrip-probe",
      requiredPermission: "Api.Synthetic",
    })
    expect(r.changed).toBe(true)
    // CRITICAL: the rest of the file outside the insertion site is byte-
    // preserved. We assert by stripping the inserted line and comparing.
    const inserted = r.insertionSnippet!
    const patched = r.content.replace(`      ${inserted}\n`, "")
    expect(patched).toBe(original)
  })
})
