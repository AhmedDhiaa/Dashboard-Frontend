# Page Builder Schema Reference

> **Audience:** engineers extending the Page Builder feature, plus reviewers
> auditing what shape a saved page can take.
> **Authority:** the Zod schemas under
> `src/features/admin-tools/page-builder/schema/` are the runtime SSOT.
> Whenever this document and the source disagree, the schemas win.

---

## 1. Map of files

The schema lives in four files:

| File | Owns | Imported by |
| :--- | :--- | :--- |
| `field-schema.ts` | Localised string, identifier patterns, `fieldSchema`, `PAGE_BUILDER_FIELD_TYPES` | every other schema file |
| `action-schema.ts` | `actionSchema` (api/navigate/dialog/drawer), `buttonSchema` | `block-schema`, `page-schema` |
| `block-schema.ts` | `dataSourceSchema`, `formLayoutSchema`, `columnSchema`, `blockSchema`, `PAGE_BUILDER_COLUMN_TYPES` | `action-schema`, `page-schema` |
| `page-schema.ts` | `pageSchema` (top-level) | external consumers (API routes, renderer, materialize pipeline) |

`action-schema` and `block-schema` form a deliberate, benign cycle: dialog/
drawer actions contain blocks, and a button block contains a button which
contains an action. Both directions are wrapped in `z.lazy(...)` so the
cycle resolves at parse time, regardless of which file is imported first.

---

## 2. `field-schema.ts`

Defines a single form field plus the primitives (localised strings,
identifier regexes, validation rules) that the rest of the schema layer
re-exports.

### Identifier patterns

Re-declared locally (not imported from `entity-builder`, which is a sibling
feature and would fail the architectural validator).

| Schema | Regex | Examples |
| :--- | :--- | :--- |
| `kebabIdSchema` | `^[a-z][a-z0-9-]{1,40}$` | `orders-list`, `business-partner` |
| `fieldNameSchema` | `^[a-z][a-zA-Z0-9_]{0,40}$` | `totalAmount`, `is_active` |
| `permissionKeySchema` | `^Api\.[A-Z][A-Za-z0-9.]{1,80}$` | `Api.Order`, `Api.Order.Update` |

### `fieldSchema`

| Property | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `name` | `fieldNameSchema` | — | required |
| `type` | `z.enum(PAGE_BUILDER_FIELD_TYPES)` | — | one of 29 values (table below) |
| `label` | `localizedStringSchema` | — | required |
| `description`, `placeholder` | `localizedStringSchema` | — | optional |
| `required`, `hidden`, `disabled` | `boolean` | `false` | |
| `defaultValue` | `unknown` | — | optional, type-driven |
| `validation` | `{ min, max, minLength, maxLength, pattern, customValidator }` | — | optional |
| `options` | `Array<{ value, label }>` | — | for `select` / `radio` / `multi-select` |
| `enumType` | `string` | — | for `enum` |
| `autocomplete` | `{ entityName?, apiEndpoint?, valueField, labelField, foreignLabelField? }` | — | for `autocomplete` / `multi-autocomplete` |
| `rows` | positive int | — | for `textarea` |
| `step`, `accept`, `colSpan` | various | — | type-specific UI hints |
| `showInList` | `boolean` | `false` | include as a table column? |
| `showInDetail` | `boolean` | `true` | |
| `showInForm` | `boolean` | `true` | |
| `condition` | `{ field, operator, value }` | — | conditional visibility |
| `permission` | `permissionKeySchema` | — | hides field if user lacks it |

### Field-type matrix — schema vs `src/core/entities/types.ts`

The Page Builder vocabulary is a **superset** of the legacy `FormFieldConfig.type`
union. Every type used in any of the 51 entity configs maps cleanly to a
Page Builder type. The reverse is not true — Page Builder adds 16 newer
types that the legacy union never carried (richtext, currency, percentage,
switch, time, date-range, multi-select, radio, multi-autocomplete, image,
image-crop, phone, url, json, color, map-location).

| `FormFieldConfig.type` (13 values, legacy) | Page Builder schema type (29 values, spec §3) | Notes |
| :--- | :--- | :--- |
| `text` | `text` | identical |
| `textarea` | `textarea` | identical |
| `number` | `number` | identical |
| `boolean` | `boolean` | identical (Page Builder also adds the visual variant `switch`) |
| `date` | `date` | identical |
| `datetime` | `datetime` | identical |
| `select` | `select` | identical |
| `autocomplete` | `autocomplete` | identical (Page Builder distinguishes `entity-autocomplete` vs `api-autocomplete` only when migrating to entity-builder JSON drafts) |
| `file` | `file` | identical |
| `password` | `password` | identical |
| `email` | `email` | identical |
| `enum` | `enum` | identical |
| `custom` | `custom` | identical |
| — | `richtext`, `currency`, `percentage`, `switch`, `time`, `date-range`, `multi-select`, `radio`, `multi-autocomplete`, `image`, `image-crop`, `phone`, `url`, `json`, `color`, `map-location` | new in Page Builder; not used by any of the 51 existing entity configs today |

**Invariant.** `PAGE_BUILDER_FIELD_TYPES` is declared
`as const satisfies readonly MasterFieldType[]`. The master union
(`src/core/entities/field-types.ts`) is the union of every field-type
vocabulary in the codebase. A drift between the Page Builder list and the
master fails type-check immediately.

---

## 3. `action-schema.ts`

### `actionSchema` (discriminated union over `type`)

| `type` | Required | Optional |
| :--- | :--- | :--- |
| `"api"` | `method` (GET/POST/PUT/DELETE/PATCH), `endpoint` (string, supports `{id}`-style interpolation) | `body`, `onSuccess: { notify, refresh, navigate }`, `onError: { notify }`, `confirm: { title, message, confirmLabel, destructive }` |
| `"navigate"` | `href` | `external` (defaults to `false`) |
| `"dialog"` | `title`, `blocks: BlockSchema[]` (recursive — wrapped in `z.lazy`) | — |
| `"drawer"` | `title`, `blocks: BlockSchema[]` | `side` (`start` / `end` / `top` / `bottom`; defaults to `end`) |

### `buttonSchema`

| Property | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `kebabIdSchema` | — | unique within its parent (page header / row / form footer) |
| `label` | `localizedStringSchema` | — | |
| `icon` | `string` | — | Lucide name |
| `variant` | `"default" / "destructive" / "outline" / "secondary" / "ghost" / "link"` | `default` | |
| `size` | `"default" / "sm" / "lg" / "icon"` | `default` | |
| `position` | `"page-header" / "row" / "form-footer" / "inline"` | — | required |
| `permission` | `permissionKeySchema` | — | hides the button |
| `hidden` | `boolean` | `false` | |
| `action` | `actionSchema` | — | embedded |
| `rowCondition` | `{ field, operator, value }` | — | for row buttons; predicate hides button per-row |

---

## 4. `block-schema.ts`

### `dataSourceSchema` (discriminated union over `type`)

| `type` | Required | Defaults |
| :--- | :--- | :--- |
| `"api"` | `endpoint` (path-shaped regex), `method` | `itemsPath="items"`, `totalCountPath="totalCount"` |
| `"entity"` | `entityName` (kebab-case) | — |
| `"swagger"` | `swaggerUrl` (URL), `operationId` | — |

### `formLayoutSchema` (discriminated union, recursive)

| `type` | Description |
| :--- | :--- |
| `"grid"` | `rows: { columns: 1\|2\|3\|4, fields: string[] }[]` — flat |
| `"tabs"` | `tabs: { id, title, icon?, layout (recursive), permission? }[]` |
| `"sections"` | `sections: { id, title, icon?, collapsible (default false), defaultOpen (default true), layout (recursive) }[]` |
| `"split"` | `left (recursive)`, `right (recursive)`, `ratio: "50/50" \| "60/40" \| "70/30"` (default `50/50`) |

### `columnSchema`

| Property | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `field` | `string.min(1)` | — | dot-paths permitted (`user.name`) |
| `type` | `z.enum(PAGE_BUILDER_COLUMN_TYPES)` | — | 18 values (see column-type matrix below) |
| `label` | `localizedStringSchema` | — | optional |
| `width` | `number \| string` | — | |
| `align` | `"start" \| "center" \| "end"` | — | |
| `sortable` | `boolean` | `true` | |
| `filterable` | `boolean` | `false` | |
| `hidden` | `boolean` | `false` | |
| `config` | `Record<string, unknown>` | — | renderer-type specific |

### `blockSchema` (discriminated union over `type`, 17 variants)

| Category | `type` values |
| :--- | :--- |
| Content | `heading`, `text`, `divider`, `spacer` |
| Layout (recursive) | `card`, `tabs`, `accordion`, `grid` |
| Data | `table`, `form`, `detail`, `kpi`, `chart`, `alert`, `map` |
| Action | `button` |
| Custom | `custom` (escape hatch — references `BlockRegistry`) |

Every block extends a common base of `{ id: kebabIdSchema, hidden: boolean,
permission?: permissionKeySchema }`.

### Column-type matrix — schema vs `FieldRendererType`

`PAGE_BUILDER_COLUMN_TYPES` (18 values from spec §3) is a **subset** of the
master column-type union, which itself is the superset of the renderer
(`FieldRendererType`, 18 values) and the entity-builder JSON
(`ListColumnDefinition.display`, 12 values).

| Page Builder column type | Renderer counterpart | Entity-builder display | Notes |
| :--- | :--- | :--- | :--- |
| `text-primary` | ✓ | ✓ | |
| `text-secondary` | ✓ | — | |
| `badge-code` | ✓ | ✓ | |
| `badge-status` | ✓ | — | |
| `badge-count` | — | — | new — render via badge variant |
| `enum` | ✓ | — | |
| `boolean` | ✓ | ✓ | |
| `datetime` | ✓ | ✓ | |
| `date` | ✓ | ✓ | |
| `time` | — | — | new |
| `currency` | ✓ | ✓ | |
| `percentage` | — | ✓ | |
| `number` | ✓ | — | |
| `image-thumbnail` | — | — | new |
| `avatar` | — | — | new |
| `user-cell` | — | — | new |
| `entity-link` | — | — | new |
| `custom` | ✓ | — | |

**Invariant.** `PAGE_BUILDER_COLUMN_TYPES` is
`as const satisfies readonly MasterColumnType[]`. Same drift-protection as
the field types.

---

## 5. `page-schema.ts`

| Property | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `kebabIdSchema` | — | unique across all pages |
| `version` | `z.literal("1.0")` | — | bumped when the schema shape changes |
| `title` | `localizedStringSchema` | — | |
| `description` | `localizedStringSchema` | — | optional |
| `permission` | `permissionKeySchema` | — | required — gates the entire page |
| `navigation` | `{ enabled, group, icon, order, href? }` | — | optional; absent = unlisted in sidebar |
| `layout` | `"full" \| "centered" \| "two-column"` | `"full"` | |
| `blocks` | `BlockSchema[]` | — | ordered |
| `onMount`, `onError` | `actionSchema` | — | lifecycle hooks |
| `createdBy`, `createdAt`, `updatedAt`, `materializedAt` | `string` | — | server-managed metadata |

The page schema owns no Zod primitives of its own — every field references
schemas from the three lower files.

---

## 6. Reuse from sibling features

| Schema piece | Source | How Page Builder reuses |
| :--- | :--- | :--- |
| Field-type vocabulary | `src/core/entities/field-types.ts` (`MasterFieldType`) | Page Builder defines its 29-value tuple `as const satisfies readonly MasterFieldType[]` |
| Column-type vocabulary | `src/core/entities/column-types.ts` (`MasterColumnType`) | same pattern with the 18-value column tuple |
| Identifier regex shapes | `src/features/admin-tools/entity-builder/types/builder-schema.ts` (`IDENT_PATTERNS`) | re-declared locally — sibling-feature import would fail the architectural validator |
| Widget data sources / visualizations | `src/shared/widgets/schema.ts` | NOT used by Page Builder data sources today; spec §3 declares its own `dataSourceSchema` (api / entity / swagger) which is structurally distinct from the widget version (entity-list / api-call). The widget exports remain available for any future block that wants to reuse them. |

---

## 7. Testing

Schema tests live in
`src/features/admin-tools/page-builder/schema/__tests__/` — one file per
schema. Each file covers:

- **Happy path:** a minimal valid example for every variant.
- **Defaults:** assertions that omitted fields receive their declared
  defaults.
- **Failures:** at least one rejection case per common authoring mistake
  (unknown enum, missing required field, malformed identifier, etc).

Run them via `npm run test`. Coverage is collected with
`npx vitest run --coverage src/features/admin-tools/page-builder/schema`.

---

## 8. Stability

Bumping `pageSchema.version` from `"1.0"` is a breaking change. Any
existing JSON page in `messages/_overrides/pages/` will fail to parse
until the migration is added. Plan such a bump alongside a parallel
`v1` → `v2` adapter.
