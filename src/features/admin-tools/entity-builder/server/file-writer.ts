/**
 * Filesystem writer for the EntityBuilder. Wraps every multi-file write in
 * a transaction-style rollback: as files are created their absolute paths
 * are pushed into a tracker; on failure the writer iterates the tracker
 * and unlinks each one so the source tree never lands in a half-written
 * state.
 *
 * Subprocess steps (init-entities, eslint --fix) run after every file
 * has settled. They're run-and-warn rather than run-and-rollback —
 * rolling back on a stylistic eslint failure would hide a successful
 * write the admin can fix manually.
 */

import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"
import { execSync } from "node:child_process"
import path from "node:path"
import { logger } from "@/shared/logger"
import { assertSafePath } from "@/shared/utils/safe-path"
import type { CodeGenPlan, GeneratedFile, I18nBundle } from "./code-generator"

// `process.cwd()` is read on EACH call site (not cached at module load) so
// the writer survives a test harness that chdirs into a sandbox between
// scenarios — and because the production cwd never changes, the production
// hot path is unaffected.
function root(): string {
  return process.cwd()
}

export interface WriteResult {
  filesWritten: string[]
  warnings: string[]
}

export interface WriteOptions {
  /** Overwrite the entity if it already exists. Default false. */
  force?: boolean
  /** Run `npm run init-entities` after writing. Default true. */
  refreshRegistry?: boolean
  /** Run `eslint --fix` over the new files. Default true. */
  lintFix?: boolean
}

class WriteAborted extends Error {
  // `cause` already exists on the modern Error type — declare with override
  // so TS doesn't flag the parameter property as a duplicate.
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
  }
}

export async function persistGeneration(plan: CodeGenPlan, options: WriteOptions = {}): Promise<WriteResult> {
  const { force = false, refreshRegistry = true, lintFix = true } = options
  // Pre-flight check runs OUTSIDE the rollback try/catch. Collisions happen
  // before any file is written, so there's nothing to roll back — wrapping
  // them in `WriteAborted` would just hide the actionable inner message
  // ("Refusing to overwrite handwritten config at …") from callers that
  // surface `err.message` directly.
  if (!force) assertNoCollision(plan.files)

  const writtenAbs: string[] = []
  const warnings: string[] = []

  try {
    for (const file of plan.files) {
      // file.path comes from generateEntityFiles which only emits paths
      // under src/domains/<...> and src/app/(dashboard)/<...>. We
      // assertSafePath every write because that defence-in-depth catches
      // any future template change that leaks an attacker-controlled
      // segment past the codegen schema validation.
      const abs = assertSafePath(file.path)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.writeFile(abs, file.content)
      writtenAbs.push(abs)
    }

    await mergeI18n(plan.i18n, "en", warnings)
    await mergeI18n(plan.i18n, "ar", warnings)

    if (refreshRegistry) runOptional("npm run init-entities", warnings)
    if (lintFix && writtenAbs.length > 0) {
      runOptional(`npx eslint --fix ${writtenAbs.map(p => `"${p}"`).join(" ")}`, warnings)
    }

    return {
      filesWritten: writtenAbs.map(p => path.relative(root(), p).replace(/\\/g, "/")),
      warnings,
    }
  } catch (err) {
    await rollback(writtenAbs)
    throw new WriteAborted(`Generation failed and rolled back ${writtenAbs.length} file(s)`, err)
  }
}

function assertNoCollision(files: GeneratedFile[]): void {
  for (const file of files) {
    const abs = path.resolve(root(), file.path)
    if (!existsSync(abs)) continue
    // `.config.tsx` (or its legacy `.config.ts` sibling) is the file an
    // engineer most often hand-edits. Force-overwriting it would silently
    // discard any custom listColumns / detailSections / formLayout the
    // entity has accumulated. Surface a louder, action-oriented message
    // so the admin understands they need to delete or rename the
    // handwritten file before re-materializing.
    if (isHandwrittenConfigPath(file.path)) {
      throw new Error(
        `Refusing to overwrite handwritten config at ${file.path}. ` +
          `Delete or rename it first if you want to regenerate.`,
      )
    }
    throw new Error(`File already exists: ${file.path}. Pass force: true to overwrite.`)
  }
}

function isHandwrittenConfigPath(p: string): boolean {
  return p.endsWith(".config.tsx") || p.endsWith(".config.ts")
}

async function mergeI18n(i18n: I18nBundle, locale: "en" | "ar", warnings: string[]): Promise<void> {
  const filePath = assertSafePath(path.join("messages", locale, "pages.json"))
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const json = JSON.parse(raw) as Record<string, unknown>
    Object.assign(json, i18n[locale])
    await fs.writeFile(filePath, JSON.stringify(json, null, 4) + "\n")
  } catch (err) {
    warnings.push(`messages/${locale}/pages.json merge failed: ${(err as Error).message}`)
  }
}

function runOptional(command: string, warnings: string[]): void {
  try {
    execSync(command, { cwd: root(), stdio: "pipe" })
  } catch (err) {
    const e = err as { stderr?: Buffer; stdout?: Buffer }
    const detail = (e.stderr ?? e.stdout ?? Buffer.from("")).toString().slice(0, 400)
    warnings.push(`${command}: ${detail}`)
  }
}

async function rollback(written: string[]): Promise<void> {
  for (const abs of written) {
    try {
      // `written` only ever holds paths that already passed assertSafePath
      // during persistGeneration, but re-asserting here keeps the
      // file-write contract uniform across the module.
      await fs.unlink(assertSafePath(abs))
    } catch (err) {
      logger.error("[entity-builder] rollback failed for", abs, err)
    }
  }
}

export { WriteAborted }

/**
 * Best-effort unlink for a list of source-relative paths.
 *
 * Used by the materialize routes to undo a SUCCESSFUL `persistGeneration`
 * when a downstream step (the registry patcher) fails. `persistGeneration`'s
 * own try/catch only rolls back when its own writes throw; once it returns
 * `WriteResult` the writer considers the entity files committed. The
 * downstream callers own the post-success rollback contract, and this
 * helper is the symmetric undo primitive.
 *
 * Errors per file are logged (not thrown) so a single missing file doesn't
 * mask the rollback's overall progress. The caller's audit row captures
 * the patcher failure that triggered the rollback in the first place.
 */
export async function rollbackFiles(filesRelative: string[]): Promise<void> {
  for (const rel of filesRelative) {
    try {
      const abs = assertSafePath(rel)
      if (!existsSync(abs)) continue
      await fs.unlink(abs)
    } catch (err) {
      logger.warn("[entity-builder] rollbackFiles: unlink failed for", rel, err)
    }
  }
}

// ─── Delete (mode='delete' from the generate route) ─────────────────────────

export interface DeleteResult {
  filesRemoved: string[]
  warnings: string[]
}

/**
 * Inverse of persistGeneration: unlinks the files generated for an entity,
 * removes its i18n keys from messages/{en,ar}/pages.json, and re-runs
 * init-entities so the registry reflects the deletion. Empty parent
 * directories left behind by the unlinks are best-effort cleaned.
 */
export async function deleteGeneration(
  plan: CodeGenPlan,
  options: { refreshRegistry?: boolean } = {},
): Promise<DeleteResult> {
  const { refreshRegistry = true } = options
  const removed: string[] = []
  const warnings: string[] = []

  for (const file of plan.files) {
    let abs: string
    try {
      abs = assertSafePath(file.path)
    } catch (err) {
      warnings.push(`refused unsafe path ${file.path}: ${(err as Error).message}`)
      continue
    }
    if (!existsSync(abs)) continue
    try {
      await fs.unlink(abs)
      removed.push(path.relative(root(), abs).replace(/\\/g, "/"))
    } catch (err) {
      warnings.push(`unlink ${file.path}: ${(err as Error).message}`)
    }
  }

  // Sweep up empty parent directories created by the original write. Walk
  // deepest-first so nested empties (e.g. `[id]/edit/`) get a chance.
  const dirs = Array.from(
    new Set(
      plan.files
        .map(f => {
          try {
            return path.dirname(assertSafePath(f.path))
          } catch {
            return null
          }
        })
        .filter((d): d is string => d !== null),
    ),
  ).sort((a, b) => b.length - a.length)
  for (const dir of dirs) {
    try {
      await fs.rmdir(dir)
    } catch {
      // non-empty or already gone — fine
    }
  }

  await pruneI18n(plan.entityName, "en", warnings)
  await pruneI18n(plan.entityName, "ar", warnings)

  if (refreshRegistry) runOptional("npm run init-entities", warnings)

  return { filesRemoved: removed, warnings }
}

async function pruneI18n(entityName: string, locale: "en" | "ar", warnings: string[]): Promise<void> {
  const filePath = assertSafePath(path.join("messages", locale, "pages.json"))
  try {
    const json = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>
    if (!(entityName in json)) return
    delete json[entityName]
    await fs.writeFile(filePath, JSON.stringify(json, null, 4) + "\n")
  } catch (err) {
    warnings.push(`messages/${locale}/pages.json prune failed: ${(err as Error).message}`)
  }
}
