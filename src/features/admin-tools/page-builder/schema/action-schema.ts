/**
 * Page Builder action / button schema (per spec §3 + §7).
 *
 * Two halves:
 *   1. `actionSchema` — discriminated union over four action kinds:
 *        - api      : fire-and-forget HTTP call
 *        - navigate : client-side route change
 *        - dialog   : open a modal dialog whose body is itself a list of blocks
 *        - drawer   : same, but slide-in
 *      Dialog and drawer recurse back into `blockSchema`, which is why the
 *      block import is wrapped in `z.lazy()` — see the cycle note below.
 *   2. `buttonSchema` — every Page Builder button is one of these (header
 *      action, row action, form-footer, inline). The `action` field embeds
 *      the union above.
 *
 * Cycle note:
 *   `blockSchema` lives in ./block-schema and ALSO imports from this file
 *   (for `buttonSchema` / `actionSchema`). Both directions reference each
 *   other via `z.lazy(...)` callbacks; the lazy callback runs at parse time,
 *   by which point both modules have finished initialising. This keeps the
 *   cycle benign regardless of which file the runtime imports first.
 */

import { z } from "zod"
import { localizedStringSchema, kebabIdSchema, permissionKeySchema } from "./field-schema"
// Intentional cycle with ./block-schema, mediated by z.lazy() at every cross-file ref. See header note.
import { blockSchema } from "./block-schema"

// ─── API action ─────────────────────────────────────────────────────────────

const apiActionSchema = z.object({
  type: z.literal("api"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  /** May contain `{id}`-style interpolation tokens; resolved by the executor. */
  endpoint: z.string().min(1),
  body: z.record(z.string(), z.unknown()).optional(),
  onSuccess: z
    .object({
      notify: localizedStringSchema.optional(),
      refresh: z.boolean().default(true),
      navigate: z.string().optional(),
    })
    .optional(),
  onError: z
    .object({
      notify: localizedStringSchema.optional(),
    })
    .optional(),
  confirm: z
    .object({
      title: localizedStringSchema,
      message: localizedStringSchema,
      confirmLabel: localizedStringSchema.optional(),
      destructive: z.boolean().default(false),
    })
    .optional(),
})

// ─── Navigate action ────────────────────────────────────────────────────────

const navigateActionSchema = z.object({
  type: z.literal("navigate"),
  href: z.string().min(1),
  external: z.boolean().default(false),
})

// ─── Dialog action (modal whose body is a list of blocks) ───────────────────

const dialogActionSchema = z.object({
  type: z.literal("dialog"),
  title: localizedStringSchema,
  blocks: z.lazy(() => z.array(blockSchema)),
})

// ─── Drawer action (side-sheet whose body is a list of blocks) ──────────────

const drawerActionSchema = z.object({
  type: z.literal("drawer"),
  title: localizedStringSchema,
  side: z.enum(["start", "end", "top", "bottom"]).default("end"),
  blocks: z.lazy(() => z.array(blockSchema)),
})

// ─── Action union ───────────────────────────────────────────────────────────

export const actionSchema = z.discriminatedUnion("type", [
  apiActionSchema,
  navigateActionSchema,
  dialogActionSchema,
  drawerActionSchema,
])
export type ActionSchema = z.infer<typeof actionSchema>

// ─── Button ─────────────────────────────────────────────────────────────────

const rowConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["eq", "ne", "in", "not-in"]),
  value: z.unknown(),
})

export const buttonSchema = z.object({
  id: kebabIdSchema,
  label: localizedStringSchema,
  icon: z.string().optional(),
  variant: z.enum(["default", "destructive", "outline", "secondary", "ghost", "link"]).default("default"),
  size: z.enum(["default", "sm", "lg", "icon"]).default("default"),
  position: z.enum(["page-header", "row", "form-footer", "inline"]),
  permission: permissionKeySchema.optional(),
  hidden: z.boolean().default(false),
  action: actionSchema,
  /** When set on a row-action, the button only renders for rows matching the predicate. */
  rowCondition: rowConditionSchema.optional(),
})
