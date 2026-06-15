/**
 * In-memory typecheck for a planned generation.
 *
 * Writes the planned files into a sibling temporary directory under
 * `.entity-builder-cache/typecheck/<timestamp>/`, runs `tsc --noEmit`
 * against the project tsconfig with that directory's files included
 * via a generated tsconfig that extends the project's. If tsc reports
 * any error in the planned files, the generation is rejected before
 * touching the real source tree.
 *
 * Limitations:
 *   - Cross-references between planned files + existing entity-config
 *     init.ts won't yet be wired (the registry still doesn't see the
 *     new entity), so we narrow the typecheck to *only* the planned
 *     files — typos inside the generated source are caught, broken
 *     symbol references against the real tree are not.
 *   - Network-isolated; no fancy editor diagnostics. Fast (~3 s).
 */

import { promises as fs } from "node:fs"
import { execSync } from "node:child_process"
import path from "node:path"
import { assertSafePath } from "@/shared/utils/safe-path"
import type { GeneratedFile } from "./code-generator"

const ROOT = process.cwd()

export interface TypecheckResult {
  ok: boolean
  errors: string[]
}

export async function typecheckPlannedFiles(files: GeneratedFile[]): Promise<TypecheckResult> {
  if (files.length === 0) return { ok: true, errors: [] }

  const id = Date.now().toString(36)
  // Sandbox lives under .entity-builder-cache/ which is whitelisted in
  // ALLOWED_ROOTS for exactly this purpose. assertSafePath catches any
  // future drift to a non-whitelisted location.
  const sandbox = assertSafePath(path.join(".entity-builder-cache", "typecheck", id))
  try {
    // Materialise each planned file under the sandbox at its real source-
    // relative path so module resolution mirrors the eventual tree.
    for (const file of files) {
      const dest = assertSafePath(path.join(".entity-builder-cache", "typecheck", id, file.path))
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.writeFile(dest, file.content)
    }
    // Sandbox tsconfig extends the project's so paths/baseUrl/jsx settings
    // carry over; `include` narrows to the just-written files.
    const tsconfig = {
      extends: path.relative(sandbox, path.join(ROOT, "tsconfig.json")).replace(/\\/g, "/"),
      compilerOptions: { noEmit: true, skipLibCheck: true },
      include: files.map(f => f.path),
    }
    await fs.writeFile(
      assertSafePath(path.join(".entity-builder-cache", "typecheck", id, "tsconfig.json")),
      JSON.stringify(tsconfig, null, 2),
    )

    try {
      execSync(`npx tsc --noEmit -p "${path.join(sandbox, "tsconfig.json")}"`, {
        cwd: ROOT,
        stdio: "pipe",
      })
      return { ok: true, errors: [] }
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer }
      const detail = (e.stdout ?? e.stderr ?? Buffer.from("")).toString()
      const errors = detail
        .split(/\r?\n/)
        .filter(line => /error TS\d+/.test(line))
        .slice(0, 25)
      return { ok: false, errors: errors.length > 0 ? errors : [detail.slice(0, 800)] }
    }
  } finally {
    // `sandbox` is the path we already validated above. Re-asserting here
    // is redundant in this code path but cheap, and keeps the rule "every
    // mutating fs call goes through assertSafePath" easy to grep.
    await fs.rm(assertSafePath(sandbox), { recursive: true, force: true }).catch(() => undefined)
  }
}
