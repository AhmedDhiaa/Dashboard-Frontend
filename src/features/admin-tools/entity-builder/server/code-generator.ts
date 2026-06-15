/**
 * Server-side code-generation API for the EntityBuilder.
 *
 * Pure functions only — no fs, no child_process, no env. The route handler
 * (route.ts) calls these to materialise file contents, then a separate
 * file-writer module is responsible for actually persisting them with
 * rollback semantics.
 *
 * Re-exports + thin wrappers around the wizard's pure generators so the
 * preview tab and the server share one source of truth. The named-export
 * shape (generateSchemaFile, generateTypesFile, …) matches the contract
 * the route handler depends on.
 */

import { extractI18nKeys, type I18nBundle } from "./extractors"
import { generateEntityFiles, type GeneratedFile } from "./file-generators"
import { toKebabCase } from "./derivations"
import type { EntityBuilderSchema } from "../types/builder-schema"

// ─── Per-file generators ────────────────────────────────────────────────────

function pickFile(schema: EntityBuilderSchema, suffix: string): string {
  const file = generateEntityFiles(schema).find(f => f.path.endsWith(suffix))
  if (!file) throw new Error(`Generator did not emit a file ending with ${suffix}`)
  return file.content
}

export function generateTypesFile(schema: EntityBuilderSchema): string {
  return pickFile(schema, `${schema.entityName}.types.ts`)
}

export function generateSchemaFile(schema: EntityBuilderSchema): string {
  return pickFile(schema, `${schema.entityName}.schema.ts`)
}

export function generateServiceFile(schema: EntityBuilderSchema): string {
  return pickFile(schema, `${schema.entityName}.service.ts`)
}

export function generateConfigFile(schema: EntityBuilderSchema): string {
  // .config.tsx, not .config.ts — see file-generators.ts for why we picked
  // the JSX extension even though the body contains no JSX today.
  return pickFile(schema, `${schema.entityName}.config.tsx`)
}

export function generateListPageFile(schema: EntityBuilderSchema): string {
  return pickFile(schema, `${toKebabCase(schema.entityNamePlural)}/page.tsx`)
}

export function generateDetailPageFile(schema: EntityBuilderSchema): string {
  return pickFile(schema, `[id]/page.tsx`)
}

export function generateEditPageFile(schema: EntityBuilderSchema): string {
  return pickFile(schema, `[id]/edit/page.tsx`)
}

/**
 * Create-page slot. The codebase convention is "edit page handles
 * id === 'create'", so there's no separate create file. Returns the same
 * content as the edit page; the writer can choose to skip duplicates.
 */
export function generateCreatePageFile(schema: EntityBuilderSchema): string {
  return generateEditPageFile(schema)
}

// ─── i18n bundle ────────────────────────────────────────────────────────────

export function generateI18nUpdates(schema: EntityBuilderSchema): I18nBundle {
  return extractI18nKeys(schema)
}

// ─── Aggregated planner ─────────────────────────────────────────────────────
//
// The route handler iterates over the planned files; rolling back on
// failure means knowing the exact set of paths up front.

export interface CodeGenPlan {
  files: GeneratedFile[]
  i18n: I18nBundle
  entityName: string
}

export function planGeneration(schema: EntityBuilderSchema): CodeGenPlan {
  return {
    files: generateEntityFiles(schema),
    i18n: extractI18nKeys(schema),
    entityName: schema.entityName,
  }
}

export type { GeneratedFile, I18nBundle }
