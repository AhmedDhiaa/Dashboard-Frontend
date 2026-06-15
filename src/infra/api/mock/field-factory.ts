/**
 * Field factory — turns a column/field path into a demo value
 * ===========================================================
 *
 * The generic CRUD mock builds each demo row by walking the field paths an
 * entity actually renders (its `listColumns`, `detailSections`, `searchFields`
 * and `filterFields`) and asking this factory for a value per leaf path. The
 * value is chosen by:
 *
 *   1. The column `type` when known (date → ISO date, currency → IQD amount,
 *      badge-status/enum → enum object, boolean → bool…).
 *   2. Otherwise the field NAME, matched against common ABP conventions
 *      (`name`, `reference`, `*amount*`, `*Info.entity.name`, `creationTime`…).
 *
 * Relation fields follow ABP's `<relation>Info.entity.<prop>` shape, so a path
 * like `salesPersonalInfo.entity.name` is materialised as
 * `{ salesPersonalInfo: { id, entity: { name } } }`. Tables therefore render
 * real text in every column instead of blanks.
 *
 * Everything is deterministic (seeded by entity + row + path) so a given row is
 * byte-stable across renders.
 */

import { BRAND_DOMAIN } from "@/shared/config/brand"
import { SeededRandom } from "./prng"
import {
  ARABIC_FIRST_NAMES,
  ARABIC_LAST_NAMES,
  COMPANY_NAMES,
  PRODUCT_NAMES,
  CATEGORY_NAMES,
  JOB_TITLES,
  IRAQI_CITIES,
  COUNTRIES,
  STATUS_ENUM,
  NOTES,
  STREETS,
  iraqiPhone,
} from "./seed-data"

/** A leaf value the mock can place into a row. */
export type LeafValue = string | number | boolean | null | { id: number; name: string; foreignName: string }

/** Lowercased helper for name matching. */
const lc = (s: string) => s.toLowerCase()

/** Does the (already lowercased) field name contain any of the needles? */
function matches(name: string, ...needles: string[]): boolean {
  return needles.some(n => name.includes(n))
}

/**
 * Set a value at a dotted path on `target`, creating intermediate objects.
 * `setPath(o, "a.b.c", 1)` → `{ a: { b: { c: 1 } } }`.
 */
export function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".")
  let cursor = target
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    if (typeof cursor[seg] !== "object" || cursor[seg] === null) {
      cursor[seg] = {}
    }
    cursor = cursor[seg] as Record<string, unknown>
  }
  cursor[segments[segments.length - 1]!] = value
}

/** Bilingual person name from a seed. */
function personName(rng: SeededRandom): string {
  return `${rng.pick(ARABIC_FIRST_NAMES)} ${rng.pick(ARABIC_LAST_NAMES)}`
}

/** A relation-kind → label-pool resolver. First matching rule wins. */
const RELATION_RULES: Array<{ needles: string[]; value: (rng: SeededRandom, foreign: boolean) => LeafValue }> = [
  { needles: ["country"], value: (rng, foreign) => (foreign ? rng.pick(COUNTRIES).en : rng.pick(COUNTRIES).ar) },
  {
    needles: ["city", "area", "park"],
    value: (rng, foreign) => (foreign ? rng.pick(IRAQI_CITIES).en : rng.pick(IRAQI_CITIES).ar),
  },
  { needles: ["item", "product", "stock"], value: rng => rng.pick(PRODUCT_NAMES) },
  { needles: ["category", "brand"], value: rng => rng.pick(CATEGORY_NAMES) },
  { needles: ["partner", "customer", "vendor", "company", "tenant"], value: rng => rng.pick(COMPANY_NAMES) },
  { needles: ["jobtitle", "job"], value: rng => rng.pick(JOB_TITLES) },
  { needles: ["currency"], value: rng => rng.pick(["دينار عراقي", "دولار أمريكي"]) },
  {
    needles: ["person", "employee", "driver", "user", "sales", "creator", "modifier", "owner"],
    value: rng => personName(rng),
  },
]

/**
 * Pick a value for a relation leaf (`...entity.<prop>`), keyed on the relation
 * name and the leaf prop, so `country` relations get country names, `city`
 * relations get city names, person relations get person names, etc.
 */
function relationLeafValue(relationName: string, leafProp: string, rng: SeededRandom): LeafValue {
  const rn = lc(relationName)
  const lp = lc(leafProp)

  if (lp === "id") return rng.int(1, 9999)
  // Phone-style relations (e.g. phoneInfo.number / .countryCode).
  if (matches(rn, "phone", "mobile", "tel")) {
    if (matches(lp, "countrycode", "code")) return rng.pick(["+964", "+965", "+98"])
    return iraqiPhone(rng.int(1, 9_999_999))
  }
  if (matches(lp, "phone", "mobile")) return iraqiPhone(rng.int(1, 9_999_999))
  if (matches(lp, "code", "reference", "ref")) return `${rng.pick(["IQ", "BG", "BS"])}-${rng.int(1000, 9999)}`

  const foreign = lp.includes("foreign") || lp.includes("english")
  const rule = RELATION_RULES.find(r => matches(rn, ...r.needles))
  return rule ? rule.value(rng, foreign) : rng.pick(COMPANY_NAMES)
}

/**
 * Generate a value for a single (possibly dotted) field path.
 *
 * @param entityName logical entity (seed component + relation-kind hints)
 * @param rowIndex   stable row index (seed component)
 * @param field      the dotted column/field path
 * @param columnType the entity-config column `type`, if known
 */
export function generateFieldValue(
  entityName: string,
  rowIndex: number,
  field: string,
  columnType?: string,
): LeafValue {
  const rng = new SeededRandom(`${entityName}:${rowIndex}:${field}`)
  const segments = field.split(".")
  const leaf = lc(segments[segments.length - 1]!)
  const isRelation = segments.includes("entity") || segments.length > 1

  // 1) Column-type-driven values (table lookup).
  const byType = columnType ? TYPE_VALUE[columnType]?.(rng) : undefined
  if (byType !== undefined) return byType

  // 2) Relation leaf (dotted path) → resolve by relation kind.
  if (isRelation) return relationLeafValue(segments[0]!, leaf, rng)

  // 3) Name-driven scalar values.
  return nameValue(entityName, leaf, rng)
}

/** Column-`type` → value generators. */
const TYPE_VALUE: Record<string, (rng: SeededRandom) => LeafValue> = {
  date: rng => isoDate(rng),
  datetime: rng => isoDate(rng),
  currency: rng => rng.int(25_000, 5_000_000),
  number: rng => rng.int(1, 5000),
  percentage: rng => rng.int(0, 100),
  boolean: rng => rng.bool(0.6),
  "boolean-system": rng => rng.bool(0.6),
  "badge-status": rng => rng.pick(STATUS_ENUM).id,
  enum: rng => rng.pick(STATUS_ENUM).id,
  "badge-code": rng => `${rng.pick(["ORD", "INV", "REF", "DOC"])}-${rng.int(10_000, 99_999)}`,
}

/** An ISO date within the last ~6 months. */
function isoDate(rng: SeededRandom): string {
  return new Date(Date.now() - rng.int(0, 180) * 86_400_000).toISOString()
}

/** Resolve a `name`/`fullName` leaf against the owning entity's kind. */
function entityName_to_label(entityName: string, rng: SeededRandom): LeafValue {
  const en = lc(entityName)
  if (matches(en, "country")) return rng.pick(COUNTRIES).ar
  if (matches(en, "city", "area")) return rng.pick(IRAQI_CITIES).ar
  if (matches(en, "item", "product")) return rng.pick(PRODUCT_NAMES)
  if (matches(en, "category", "brand")) return rng.pick(CATEGORY_NAMES)
  if (matches(en, "partner", "customer", "vendor")) return rng.pick(COMPANY_NAMES)
  if (matches(en, "employee", "user", "driver")) return personName(rng)
  if (matches(en, "job")) return rng.pick(JOB_TITLES)
  return rng.pick(COMPANY_NAMES)
}

/**
 * Ordered name-matching rules. The first whose needles match the (lowercased)
 * leaf wins. `entityName` is passed through for `name`-style leaves.
 */
const NAME_RULES: Array<{ needles: string[]; value: (rng: SeededRandom, entityName: string) => LeafValue }> = [
  { needles: ["reference", "ref", "serial", "barcode"], value: rng => refCode(rng) },
  { needles: ["fullname", "displayname"], value: (rng, en) => entityName_to_label(en, rng) },
  { needles: ["foreignname", "englishname", "latinname"], value: rng => rng.pick(COUNTRIES).en },
  { needles: ["firstname"], value: rng => rng.pick(ARABIC_FIRST_NAMES) },
  { needles: ["lastname", "surname"], value: rng => rng.pick(ARABIC_LAST_NAMES) },
  { needles: ["title"], value: rng => rng.pick([...JOB_TITLES, ...CATEGORY_NAMES]) },
  { needles: ["email"], value: rng => `user${rng.int(100, 999)}@${BRAND_DOMAIN}` },
  { needles: ["phone", "mobile", "tel"], value: rng => iraqiPhone(rng.int(1, 9_999_999)) },
  { needles: ["address", "street", "location"], value: rng => `${rng.pick(STREETS)}، ${rng.pick(IRAQI_CITIES).ar}` },
  { needles: ["note", "remark", "comment", "description", "body"], value: rng => rng.pick(NOTES) },
  {
    needles: ["amount", "price", "total", "cost", "balance", "salary", "value", "fee", "debit", "credit"],
    value: rng => rng.int(25_000, 5_000_000),
  },
  {
    needles: ["quantity", "qty", "count", "stock", "volume", "weight", "length", "width", "height"],
    value: rng => rng.int(1, 5000),
  },
  { needles: ["rate", "percent", "discount", "tax", "ratio"], value: rng => rng.decimal(0, 100, 1) },
  { needles: ["latitude", "lat"], value: rng => rng.decimal(30, 37, 4) },
  { needles: ["longitude", "lng", "long"], value: rng => rng.decimal(43, 48, 4) },
  { needles: ["date", "time", "createdon", "modifiedon", "expiry", "due"], value: rng => isoDate(rng) },
  { needles: ["status", "state", "type"], value: rng => rng.pick(STATUS_ENUM).id },
  {
    needles: ["active", "enabled", "warehouse", "system", "deleted", "verified", "has"],
    value: rng => rng.bool(0.6),
  },
  { needles: ["concurrencystamp", "stamp"], value: rng => rng.int(100000, 999999).toString(16) },
]

/** `XXX-12345` style reference code. */
function refCode(rng: SeededRandom): string {
  return `${rng.pick(["ORD", "INV", "REF", "DOC", "VH"])}-${rng.int(10_000, 99_999)}`
}

/** Resolve a non-relation scalar leaf from its name. */
function nameValue(entityName: string, leaf: string, rng: SeededRandom): LeafValue {
  if (leaf === "id") return rng.int(1, 99_999)
  if (leaf === "name") return entityName_to_label(entityName, rng)
  if (leaf === "code" || leaf === "number") return refCode(rng)
  const rule = NAME_RULES.find(r => matches(leaf, ...r.needles))
  if (rule) return rule.value(rng, entityName)
  // Fallback — short readable text.
  return rng.pick([...COMPANY_NAMES, ...PRODUCT_NAMES, ...CATEGORY_NAMES])
}
