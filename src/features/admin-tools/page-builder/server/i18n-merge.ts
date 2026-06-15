/**
 * Merges Page Builder localized strings into `messages/{en,ar}/pages_dynamic.json`.
 *
 * Called from the page CRUD route on every successful save and delete.
 * Each call is mutex-guarded per locale so two concurrent saves don't
 * step on each other's writes (mirrors the lock pattern in
 * `src/app/api/i18n/_lib/storage.ts`).
 *
 * Layout: top-level keys are pageIds. Each page's subtree mirrors what
 * `extractPageI18n` produces in `code-generator.ts` — the same helper is
 * reused so on-disk shape and materialized i18n are byte-identical.
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import { logger } from "@/shared/logger"
import { assertSafePath } from "@/shared/utils/safe-path"
import type { PageSchema } from "../schema/page-schema"
import { extractPageI18n } from "./code-generator"

type Locale = "en" | "ar"
const LOCALES: readonly Locale[] = ["en", "ar"]

const PAGES_DYNAMIC_DIR = path.join(process.cwd(), "messages")

const locks = new Map<Locale, Promise<unknown>>()

async function withLocaleLock<T>(locale: Locale, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(locale) ?? Promise.resolve()
  const next = previous.then(fn, fn)
  locks.set(
    locale,
    next.finally(() => {
      if (locks.get(locale) === next) locks.delete(locale)
    }),
  )
  return next
}

function filePathFor(locale: Locale): string {
  return assertSafePath(path.join(PAGES_DYNAMIC_DIR, locale, "pages_dynamic.json"))
}

async function readBundle(locale: Locale): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(filePathFor(locale), "utf8")
    const parsed = raw.trim() ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw err
  }
}

async function writeBundle(locale: Locale, bundle: Record<string, unknown>): Promise<void> {
  // Sort keys for deterministic diffs.
  const sorted: Record<string, unknown> = {}
  for (const k of Object.keys(bundle).sort()) sorted[k] = bundle[k]
  await fs.writeFile(filePathFor(locale), JSON.stringify(sorted, null, 2) + "\n")
}

/**
 * Replace the subtree for `schema.id` in `pages_dynamic.json` (both locales)
 * with the freshly-extracted bundle. Run after every successful save.
 *
 * Best-effort: a write failure is logged but does NOT roll the page save
 * back — admins can re-trigger the i18n merge by saving again.
 */
export async function mergePageI18n(schema: PageSchema): Promise<{ keysWritten: number; warnings: string[] }> {
  const warnings: string[] = []
  const bundle = extractPageI18n(schema)
  let keys = 0
  for (const locale of LOCALES) {
    try {
      await withLocaleLock(locale, async () => {
        const current = await readBundle(locale)
        current[schema.id] = bundle[locale][schema.id]
        await writeBundle(locale, current)
      })
      keys += countLeaves(bundle[locale][schema.id])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown"
      warnings.push(`merge ${locale}: ${message}`)
      logger.warn(`[page-builder] pages_dynamic.json merge failed for ${locale}`, err)
    }
  }
  return { keysWritten: keys, warnings }
}

/**
 * Remove a page's subtree from `pages_dynamic.json`. Called from the
 * DELETE route so deleted pages don't leak orphan keys.
 */
export async function removePageI18n(pageId: string): Promise<{ removed: boolean; warnings: string[] }> {
  const warnings: string[] = []
  let removed = false
  for (const locale of LOCALES) {
    try {
      await withLocaleLock(locale, async () => {
        const current = await readBundle(locale)
        if (pageId in current) {
          delete current[pageId]
          await writeBundle(locale, current)
          removed = true
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown"
      warnings.push(`remove ${locale}: ${message}`)
    }
  }
  return { removed, warnings }
}

function countLeaves(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "string") return 1
  if (Array.isArray(value)) return value.reduce<number>((sum, v) => sum + countLeaves(v), 0)
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce<number>((sum, v) => sum + countLeaves(v), 0)
  }
  return 0
}
