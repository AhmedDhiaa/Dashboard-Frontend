/**
 * Page Builder page schema (per spec §3, top-level).
 *
 * Every Page Builder page — whether stored as JSON in
 * `messages/_overrides/pages/<pageId>.json` or materialised to source under
 * `src/app/(dashboard)/pages/<pageId>/` — conforms to this schema.
 *
 * Composition:
 *   - `id`, `version`, `title`, `description`, `permission` — page identity
 *   - `navigation` — optional sidebar registration
 *   - `layout`     — page-level frame (full / centered / two-column)
 *   - `blocks`     — ordered list of blocks (see block-schema.ts)
 *   - `onMount`, `onError` — lifecycle hooks (each is an action)
 *   - metadata     — created/updated/materialized timestamps
 *
 * This module owns NO Zod primitives of its own — everything composes
 * existing schemas. Adding fields to a block? Edit block-schema. Adding
 * field types? Edit field-schema. Adding actions? Edit action-schema.
 */

import { z } from "zod"
import { localizedStringSchema, kebabIdSchema, permissionKeySchema } from "./field-schema"
import { actionSchema } from "./action-schema"
import { blockSchema } from "./block-schema"

// ─── Navigation ─────────────────────────────────────────────────────────────

const navigationSchema = z.object({
  enabled: z.boolean().default(true),
  /** Matches a `titleKey` from `src/shared/config/navigation.ts` (e.g. `"nav.fleet"`). */
  group: z.string().min(1),
  /** Lucide icon name; the runtime resolves it through a registered map. */
  icon: z.string().min(1),
  order: z.number().int().default(100),
  /** Defaults to `/pages/<id>` when absent. */
  href: z.string().optional(),
})

// ─── Page schema (top-level) ────────────────────────────────────────────────

export const pageSchema = z.object({
  id: kebabIdSchema,
  version: z.literal("1.0"),
  title: localizedStringSchema,
  description: localizedStringSchema.optional(),
  permission: permissionKeySchema,
  navigation: navigationSchema.optional(),
  layout: z.enum(["full", "centered", "two-column"]).default("full"),
  blocks: z.array(blockSchema),
  // ─── Lifecycle hooks ────────────────────────────────────────────────────
  onMount: actionSchema.optional(),
  onError: actionSchema.optional(),
  // ─── Metadata (server-managed) ──────────────────────────────────────────
  createdBy: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  /** Set when the page is promoted from override → source. */
  materializedAt: z.string().optional(),
})

export type PageSchema = z.infer<typeof pageSchema>
