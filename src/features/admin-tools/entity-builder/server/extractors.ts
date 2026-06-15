/**
 * Pure extractors used by the codegen pipeline:
 *   - extractI18nKeys → { en, ar } objects to be merged into messages/<lang>/pages.json
 *
 * Originally lived under `wizard/review/extractors.ts`. Moved into `server/`
 * when the wizard UI was retired; the codegen pipeline still needs them.
 */

import type { EntityBuilderSchema } from "../types/builder-schema"

export interface I18nBundle {
  en: Record<string, unknown>
  ar: Record<string, unknown>
}

/**
 * Builds the per-locale page subtree the runtime consumes via
 * `t("pages.<entityName>.<key>")`. Every key referenced by the rich config
 * (translations block, formFields placeholders, listColumn titleKeys,
 * detailSection field labelKeys, formLayout section titleKeys, success
 * toasts) gets a stable home here so a newly generated entity has its
 * full i18n surface populated.
 *
 * AR mirrors EN for any key the schema doesn't carry an explicit Arabic
 * value for. That's a deliberate "the codegen does not invent translations"
 * contract: an admin pass over the AR bundle is required before shipping,
 * and tooling can find untouched keys by looking for AR == EN strings.
 */
export function extractI18nKeys(schema: EntityBuilderSchema): I18nBundle {
  const en = buildLocaleSubtree(schema, "en")
  const ar = buildLocaleSubtree(schema, "ar")
  return {
    en: { [schema.entityName]: en },
    ar: { [schema.entityName]: ar },
  }
}

type Locale = "en" | "ar"

function buildLocaleSubtree(schema: EntityBuilderSchema, locale: Locale): Record<string, unknown> {
  const subtree = buildEntityHeader(schema, locale)
  addPerFieldEntries(subtree, schema, locale)
  addSectionTitles(subtree, schema, locale)
  return subtree
}

/**
 * Entity-level translation keys: title, description, the three page-title
 * variants, the search-placeholder, and the three success-toast keys.
 * Mirror semantics live here.
 */
function buildEntityHeader(schema: EntityBuilderSchema, locale: Locale): Record<string, unknown> {
  const t = schema.translations[locale]
  const otherLocale: Locale = locale === "en" ? "ar" : "en"
  const fb = schema.translations[otherLocale]
  const title = t.title || fb.title
  // English-anchored synthesised copy. Both locales receive the same
  // English string for the success-toast / detail-title / etc. families
  // unless the schema carries explicit per-locale text — that way we
  // never ship machine-translated Arabic; the admin overwrites later.
  const enTitle = schema.translations.en.title || schema.translations.ar.title
  return {
    title,
    description: t.description ?? fb.description ?? title,
    searchPlaceholder: t.searchPlaceholder ?? fb.searchPlaceholder ?? title,
    detail_title: t.detailTitle ?? fb.detailTitle ?? `${title} details`,
    create_title: t.createTitle ?? fb.createTitle ?? `Create ${title}`,
    edit_title: t.editTitle ?? fb.editTitle ?? `Edit ${title}`,
    create_success: `${enTitle} created successfully`,
    update_success: `${enTitle} updated successfully`,
    delete_success: `${enTitle} deleted successfully`,
  }
}

function addPerFieldEntries(subtree: Record<string, unknown>, schema: EntityBuilderSchema, locale: Locale): void {
  const otherLocale: Locale = locale === "en" ? "ar" : "en"
  for (const f of schema.fields) {
    const label = f.label[locale] || f.label[otherLocale]
    subtree[f.name] = label
    subtree[`${f.name}_placeholder`] = f.placeholder?.[locale] ?? f.placeholder?.[otherLocale] ?? label
  }
}

function addSectionTitles(subtree: Record<string, unknown>, schema: EntityBuilderSchema, locale: Locale): void {
  const otherLocale: Locale = locale === "en" ? "ar" : "en"
  const enTitle = schema.translations.en.title || schema.translations.ar.title
  schema.formLayout.forEach((row, i) => {
    const idx = i + 1
    subtree[`section_${idx}_title`] =
      row.sectionTitle?.[locale] ?? row.sectionTitle?.[otherLocale] ?? `${enTitle} — section ${idx}`
  })
}
