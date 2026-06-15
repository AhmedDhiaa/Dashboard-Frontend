/**
 * Page Builder code generator (per spec §12).
 *
 * Pure module — no fs, no env, no child_process. The materialize route
 * calls these to build a `CodeGenPlan` (the same shape entity-builder
 * uses, so it can flow through `persistGeneration` unchanged), then
 * passes it to the file-writer which actually persists.
 *
 * Three files are emitted under `src/app/(dashboard)/pages/<pageId>/`:
 *
 *   - `page.tsx`     — server component that imports the schema and hands
 *                      it to `<PageRenderer>`. Identical structure for every
 *                      page, only the imported schema name differs.
 *   - `schema.ts`    — the typed page schema as a default export. Inlined
 *                      JSON; a `pageSchema.parse(...)` call at module load
 *                      throws loudly if the on-disk file ever drifts from
 *                      the runtime contract.
 *   - `types.ts`     — re-exports + the page id literal. Phase 7 keeps
 *                      this minimal; future phases derive interfaces from
 *                      the field schemas.
 *
 * Plus an i18n bundle merged into `messages/{en,ar}/pages.json` under
 * `pages.<pageId>.title` etc.
 */

import type {
  CodeGenPlan,
  GeneratedFile,
  I18nBundle,
} from "@/features/admin-tools/entity-builder/server/code-generator"
import type { PageSchema } from "../schema/page-schema"

const TARGET_DIR_PREFIX = "src/app/(dashboard)/pages"

/**
 * Phase 7 ships zero registered custom-block component names. Every
 * `type: "custom"` block in a schema must have a `componentName` listed
 * here — otherwise the materialize is refused (per the user's "ارفض
 * الـ materialize مع رسالة واضحة" rule). When a future phase wires a
 * registered custom block, add its name here.
 */
export const ALLOWED_CUSTOM_BLOCK_COMPONENTS: ReadonlySet<string> = new Set<string>()

interface BlockNode {
  id: string
  type: string
}

interface CustomBlockNode extends BlockNode {
  type: "custom"
  componentName: string
}

/**
 * Walk every block in the schema (recursively into card/tabs/accordion/
 * grid + nested action-block dialogs/drawers) and return any custom
 * blocks whose `componentName` isn't in the allowlist. Empty array =
 * safe to materialize.
 */
export function findUnknownCustomBlocks(schema: PageSchema): CustomBlockNode[] {
  const offenders: CustomBlockNode[] = []
  const walk = (block: unknown): void => {
    if (!block || typeof block !== "object") return
    const node = block as BlockNode & {
      blocks?: unknown[]
      tabs?: { blocks?: unknown[] }[]
      items?: { blocks?: unknown[] }[]
      componentName?: string
    }
    if (node.type === "custom") {
      const name = node.componentName ?? ""
      if (!ALLOWED_CUSTOM_BLOCK_COMPONENTS.has(name)) {
        offenders.push({ id: node.id, type: "custom", componentName: name })
      }
    }
    node.blocks?.forEach(walk)
    node.tabs?.forEach(t => t.blocks?.forEach(walk))
    node.items?.forEach(i => i.blocks?.forEach(walk))
  }
  schema.blocks.forEach(walk)
  return offenders
}

// ─── i18n extraction ────────────────────────────────────────────────────────

/**
 * Flatten every `{ en, ar }` pair in the schema into a `pages.<pageId>`
 * subtree. Spec §9: keys land under `pages.<pageId>.title`,
 * `pages.<pageId>.description`, `pages.<pageId>.blocks.<n>.<...>` etc.
 *
 * The runtime PageRenderer reads these via the `pages_dynamic`
 * namespace (see renderer/PageRenderer.tsx); the extractor here is the
 * write side of that contract.
 */
export function extractPageI18n(schema: PageSchema): I18nBundle {
  const en: Record<string, unknown> = {}
  const ar: Record<string, unknown> = {}
  set(en, ar, "title", schema.title)
  if (schema.description) set(en, ar, "description", schema.description)
  schema.blocks.forEach((block, idx) => extractBlockI18n(block, idx, en, ar))
  return { en: { [schema.id]: en }, ar: { [schema.id]: ar } }
}

function set(en: Record<string, unknown>, ar: Record<string, unknown>, key: string, ls: { en: string; ar: string }) {
  en[key] = ls.en
  ar[key] = ls.ar
}

function extractBlockI18n(block: unknown, idx: number, en: Record<string, unknown>, ar: Record<string, unknown>) {
  if (!block || typeof block !== "object") return
  const node = block as { type: string; text?: { en: string; ar: string }; title?: { en: string; ar: string } }
  const enBlock: Record<string, unknown> = {}
  const arBlock: Record<string, unknown> = {}
  if (node.text) set(enBlock, arBlock, "text", node.text)
  if (node.title) set(enBlock, arBlock, "title", node.title)
  if (Object.keys(enBlock).length === 0) return
  if (!en.blocks) en.blocks = []
  if (!ar.blocks) ar.blocks = []
  ;(en.blocks as Record<string, unknown>[])[idx] = enBlock
  ;(ar.blocks as Record<string, unknown>[])[idx] = arBlock
}

// ─── File generation ────────────────────────────────────────────────────────

const HEADER = (kind: string, pageId: string): string => `/**
 * ${kind} for the materialized Page Builder page "${pageId}".
 *
 * AUTOGENERATED — do not edit by hand. Regenerate by re-running the
 * Page Builder canvas's "Materialize" action against the matching
 * runtime schema. This file is committed to source so it round-trips
 * through tsc + the bundle-budget gate before reaching production.
 */

`

export function generatePageTsxFile(pageId: string): GeneratedFile {
  return {
    path: `${TARGET_DIR_PREFIX}/${pageId}/page.tsx`,
    language: "tsx",
    content: `${HEADER("Server route", pageId)}import { PageRenderer } from "@/features/admin-tools/page-builder/renderer/PageRenderer"
import schema from "./schema"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default function Page() {
  return <PageRenderer schema={schema} />
}
`,
  }
}

export function generateSchemaFile(schema: PageSchema): GeneratedFile {
  const pageId = schema.id
  // JSON.stringify produces a fully-quoted literal that's safe to inline —
  // no template-string interpolation hazard; identifiers in the schema
  // were already validated by `pageSchema.parse(...)` at write time.
  const literal = JSON.stringify(schema, null, 2)
  return {
    path: `${TARGET_DIR_PREFIX}/${pageId}/schema.ts`,
    language: "ts",
    content: `${HEADER("Schema literal", pageId)}import { pageSchema, type PageSchema } from "@/features/admin-tools/page-builder/schema/page-schema"

// Validate at module load — catches drift between the on-disk literal and
// the runtime schema even after a refactor.
const schema: PageSchema = pageSchema.parse(${literal}) as PageSchema

export default schema
`,
  }
}

export function generateTypesFile(pageId: string): GeneratedFile {
  return {
    path: `${TARGET_DIR_PREFIX}/${pageId}/types.ts`,
    language: "ts",
    content: `${HEADER("Type re-exports", pageId)}export type { PageSchema } from "@/features/admin-tools/page-builder/schema/page-schema"

export const PAGE_ID = ${JSON.stringify(pageId)} as const
export type PageId = typeof PAGE_ID
`,
  }
}

// ─── Plan ───────────────────────────────────────────────────────────────────

export interface PageCodeGenPlan extends CodeGenPlan {
  /** Spec §8 — suggested sidebar entry surfaced to the admin. The
   *  dynamic-pages section (see components/DynamicPagesSection.tsx)
   *  reads the suggestion when rendering the sidebar. */
  navigationSuggestion: {
    enabled: boolean
    group: string
    icon: string
    order: number
    href: string
    titleKey: string
  } | null
}

export function planPageGeneration(schema: PageSchema): PageCodeGenPlan {
  const files: GeneratedFile[] = [
    generatePageTsxFile(schema.id),
    generateSchemaFile(schema),
    generateTypesFile(schema.id),
  ]
  const i18n = extractPageI18n(schema)
  const navigationSuggestion = schema.navigation
    ? {
        enabled: schema.navigation.enabled,
        group: schema.navigation.group,
        icon: schema.navigation.icon,
        order: schema.navigation.order,
        href: schema.navigation.href ?? `/pages/${schema.id}`,
        titleKey: `pages.${schema.id}.title`,
      }
    : null
  return { files, i18n, entityName: schema.id, navigationSuggestion }
}
