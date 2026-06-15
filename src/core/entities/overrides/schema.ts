/**
 * Override allow-list for system entities.
 *
 * The runtime registry holds full `EntityConfig` objects with code-only
 * fields (icons, services, Zod factories, render functions). Only the
 * scalar / JSON-safe subset below can be edited through the admin UI —
 * touching anything else would either need source-code changes or break
 * structuredClone on the wire.
 *
 * Translations (`config.translations.*`) are intentionally NOT here —
 * the existing translation editor (`/admin/translations`) already
 * overrides every user-visible string via the i18n namespace pipeline.
 * Duplicating it would create two sources of truth.
 */

import { z } from "zod"

export const formFieldOverrideSchema = z
  .object({
    label: z.string().optional(),
    description: z.string().optional(),
    placeholder: z.string().optional(),
    required: z.boolean().optional(),
    disabled: z.boolean().optional(),
    hidden: z.boolean().optional(),
    rows: z.number().int().positive().optional(),
    colSpan: z.number().int().positive().optional(),
    min: z.union([z.number(), z.string()]).optional(),
    max: z.union([z.number(), z.string()]).optional(),
    step: z.union([z.number(), z.string()]).optional(),
    // Per-type extras emitted by the runtime-builder generator. Each one
    // is admin-tweakable so an entity can be re-themed (e.g. EUR → USD)
    // without re-materializing. Caps mirror the builder-schema validators
    // so an override never widens what the source-side accepts.
    currencyCode: z
      .string()
      .regex(/^[A-Z]{3}$/, "currencyCode must be a 3-letter ISO code")
      .optional(),
    accept: z
      .string()
      .regex(/^[a-zA-Z0-9.,*/_+-]{1,200}$/, "accept must be a comma-separated MIME / extension list")
      .optional(),
    maxSizeKB: z.number().int().positive().max(1_000_000).optional(),
    displayField: z
      .string()
      .regex(/^[a-z][a-zA-Z0-9_]{0,40}$/, "displayField must be a JS identifier")
      .optional(),
  })
  .strict()

export type FormFieldOverride = z.infer<typeof formFieldOverrideSchema>

export const entityOverrideSchema = z
  .object({
    singularName: z.string().min(1).optional(),
    pluralName: z.string().min(1).optional(),
    defaultPageSize: z.number().int().positive().max(500).optional(),
    defaultSort: z
      .object({
        field: z.string().min(1),
        direction: z.enum(["asc", "desc"]),
      })
      .strict()
      .optional(),
    features: z
      .object({
        create: z.boolean().optional(),
        edit: z.boolean().optional(),
        delete: z.boolean().optional(),
        view: z.boolean().optional(),
        export: z.boolean().optional(),
        import: z.boolean().optional(),
        bulkDelete: z.boolean().optional(),
      })
      .strict()
      .optional(),
    permissionKey: z.string().optional(),
    basePath: z.string().optional(),
    formFieldOrder: z.array(z.string()).optional(),
    formFields: z.record(z.string(), formFieldOverrideSchema).optional(),
  })
  .strict()

export type EntityOverride = z.infer<typeof entityOverrideSchema>

export const entityOverrideMapSchema = z.record(z.string(), entityOverrideSchema)

export type EntityOverrideMap = z.infer<typeof entityOverrideMapSchema>
