# Extending the Page Builder — Developer Guide

> **Audience:** developers adding a new block type to the registry.
> **Prerequisite:** read [`architecture.md`](./architecture.md) and
> [`schema.md`](./schema.md) first.

This guide walks through adding a brand-new block — a "stat-comparison"
block that renders two `StatCard`s side-by-side and shows the percentage
delta between them. Every step that's also required for any new block
is called out so you can use this as a recipe.

---

## 1. Before you start

Decide the answers to these four questions:

1. **What existing component does the block wrap?** Per spec §1, every
   block must wrap an existing primitive / CRUD component / renderer.
   If nothing fits, *extend* the closest existing component to be more
   general — don't fork a parallel one.
2. **What category does it belong to?** `content` / `layout` / `data` /
   `form` / `action` / `custom`. The category drives palette grouping
   and tells the canvas where to surface it.
3. **What props does it carry?** Everything the runtime needs to render
   it. Keep them flat where possible; nested objects work but the
   PropertiesPanel JSON editor handles flat shapes most cleanly.
4. **Does it have nested blocks?** If yes, follow the layout-block
   pattern (Section 5 below). If not, the simpler content-block path
   in Sections 2-4 applies.

For the example block: it wraps `StatCard` (existing), category `data`,
props `{ id, type: "stat-comparison", before, after, label }`, no
nested blocks.

---

## 2. Step 1 — Add the Zod schema

Open `src/features/admin-tools/page-builder/schema/block-schema.ts`.

```typescript
export const statComparisonBlock = z.object({
  ...baseBlockProps,
  type: z.literal("stat-comparison"),
  label: localizedStringSchema,
  before: z.object({
    valueField: z.string().min(1),
    label: localizedStringSchema,
  }),
  after: z.object({
    valueField: z.string().min(1),
    label: localizedStringSchema,
  }),
  dataSource: dataSourceSchema,
})
```

Add the export to the `blockSchema` discriminated union at the bottom
of the file:

```typescript
export const blockSchema: z.ZodType = z.discriminatedUnion("type", [
  // … existing blocks …
  statComparisonBlock,
])
```

This is the **only** schema-level change. Once it's in, the canvas can
already round-trip the block through save/load — even before there's
a Render component.

---

## 3. Step 2 — Build the Render component

Create `src/features/admin-tools/page-builder/registry/blocks/stat-comparison-block.tsx`:

```tsx
"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import { StatCard } from "@/ui/design-system/primitives/stat-card"
import { statComparisonBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"

type Props = z.infer<typeof statComparisonBlock>

const StatComparisonRender: ComponentType<Props> = ({ before, after, label, hidden }) => {
  if (hidden) return null
  // Phase-9 placeholder: data wiring lands later. Show schema-known labels.
  return (
    <div className="space-y-2" data-block-type="stat-comparison">
      <h3 className="text-sm font-semibold text-muted-foreground">{label.en}</h3>
      <div className="grid grid-cols-2 gap-3">
        <StatCard title={before.label.en} value="—" />
        <StatCard title={after.label.en} value="—" />
      </div>
    </div>
  )
}

export const statComparisonBlockDefinition: BlockDefinition<Props> = {
  type: "stat-comparison",
  category: "data",
  displayName: { en: "Stat comparison", ar: "مقارنة إحصائية" },
  icon: "TrendingUp",
  description: { en: "Two KPIs side-by-side with a delta.", ar: "مؤشّران متقابلان." },
  propsSchema: statComparisonBlock,
  defaultProps: statComparisonBlock.parse({
    id: "stat-comparison-1",
    type: "stat-comparison",
    label: { en: "This month vs last", ar: "هذا الشهر مقابل السابق" },
    before: {
      valueField: "lastMonthTotal",
      label: { en: "Last month", ar: "الشهر السابق" },
    },
    after: {
      valueField: "thisMonthTotal",
      label: { en: "This month", ar: "هذا الشهر" },
    },
    dataSource: { type: "entity", entityName: "order" },
  }),
  Render: StatComparisonRender,
  wraps: {
    componentPath: "src/ui/design-system/primitives/stat-card.tsx",
    componentName: "StatCard (×2)",
  },
}
```

### Required fields

| Field | Why |
| :--- | :--- |
| `type` | Discriminator. Must match the literal in your Zod variant. |
| `category` | Determines palette grouping. |
| `displayName` + `description` | Bilingual — both languages required. |
| `icon` | Lucide name. Resolved at render time by the palette. |
| `propsSchema` | Your Zod variant. Used to validate edits in PropertiesPanel. |
| `defaultProps` | What gets dropped on the canvas first. Run through `propsSchema.parse(...)` so defaults are typed-correct. |
| `Render` | The runtime component. |
| `wraps.{componentPath, componentName}` | Traceability. Registration **fails** if these are absent. |

---

## 4. Step 3 — Register the block

Open `src/features/admin-tools/page-builder/registry/block-registry.ts`,
import your definition, and add it to the registration list:

```typescript
import { statComparisonBlockDefinition } from "./blocks/stat-comparison-block"

// … existing imports …

blockRegistry.register(headingBlockDefinition)
// … existing registrations …
blockRegistry.register(statComparisonBlockDefinition)
```

That's it for the runtime. The block now appears in the palette under
its category. Drop one onto the canvas, save the page, and reload —
the schema round-trips through Zod, the registry dispatches your
Render, and the PropertiesPanel JSON editor lets admins tweak.

---

## 5. Step 4 — (Layout blocks only) Children handling

Skip this section if your block doesn't contain nested blocks.

The runtime separates **schema** (where nested blocks live as
`blocks: BlockSchema[]`) from **rendering** (where pre-resolved JSX
is passed in). Layout blocks accept React children in one of two
patterns:

**Pattern A — single children prop** (used by `card`, `grid`):

```tsx
type Props = z.infer<typeof myLayoutBlock> & { children?: ReactNode }

const Render: ComponentType<Props> = ({ children, hidden }) => {
  if (hidden) return null
  return <Card><CardContent>{children}</CardContent></Card>
}
```

`BlockRenderer` walks `block.blocks[]` recursively and passes the
result via React's standard `children` prop.

**Pattern B — id-keyed map** (used by `tabs`, `accordion`):

```tsx
type Props = z.infer<typeof myTabsBlock> & {
  tabContents?: Record<string, ReactNode>
}

const Render: ComponentType<Props> = ({ tabs, tabContents }) => (
  <Tabs>
    {tabs.map(t => <TabsContent key={t.id} value={t.id}>{tabContents?.[t.id]}</TabsContent>)}
  </Tabs>
)
```

Both patterns avoid importing `blockRegistry` from inside block files
— that would create a load-order cycle. The orchestrator (`BlockRenderer`)
owns the recursion.

---

## 6. Step 5 — Tests

Add a vitest spec under
`src/features/admin-tools/page-builder/registry/blocks/__tests__/`:

```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { statComparisonBlockDefinition } from "../stat-comparison-block"

describe("statComparisonBlock — Render", () => {
  const { Render, defaultProps } = statComparisonBlockDefinition

  it("renders both side labels", () => {
    render(<Render {...defaultProps} />)
    expect(screen.getByText("Last month")).toBeInTheDocument()
    expect(screen.getByText("This month")).toBeInTheDocument()
  })

  it("hides itself when hidden=true", () => {
    const { container } = render(<Render {...defaultProps} hidden />)
    expect(container.firstChild).toBeNull()
  })
})
```

The block-registry test (`registry/__tests__/block-registry.test.ts`)
auto-validates that:
- `defaultProps` parses through `propsSchema`.
- `wraps.componentPath` is set.
- `displayName.en` and `displayName.ar` are both non-empty.

You don't need to update those — they iterate over the registry.

---

## 7. Step 6 — (Heavy components only) Dynamic import

If your block depends on a library on the
`no-static-heavy-import` allowlist (recharts, xlsx, framer-motion,
cmdk, react-easy-crop, jspdf, @googlemaps/js-api-loader), you MUST
load it via `next/dynamic`. Pattern:

```tsx
import dynamic from "next/dynamic"

const DynamicHeavyComponent = dynamic(() => import("@/some/heavy/path"), {
  ssr: false,
  loading: () => <div className="animate-pulse" data-testid="block-loading" />,
})
```

The `chart-block` and `map-block` are reference implementations.

---

## 8. Step 7 — (Custom block "escape hatch") Allowlist

If your block is the `custom` block carrying a `componentName` string,
**also** add the component name to
`src/features/admin-tools/page-builder/server/code-generator.ts`:

```typescript
export const ALLOWED_CUSTOM_BLOCK_COMPONENTS: ReadonlySet<string> = new Set<string>([
  "MyNewCustomComponent",
])
```

The materialize pipeline rejects any schema with a `custom` block
whose `componentName` isn't in this set. This is a deliberate gate —
custom blocks bypass the structured schema, so we won't write source
code referencing one that doesn't exist on the bundle path.

---

## 9. Definition of done

- [ ] Zod variant added to `block-schema.ts` and to the union.
- [ ] Block file under `registry/blocks/` exports a `BlockDefinition`.
- [ ] Block registered in `block-registry.ts`.
- [ ] Vitest specs cover happy path + the `hidden` branch + (for layout
      blocks) children rendering.
- [ ] (Heavy lib) Dynamic import in place.
- [ ] (Custom-block component) Name added to
      `ALLOWED_CUSTOM_BLOCK_COMPONENTS`.
- [ ] `npm run quality` green.
- [ ] Tested manually: drop on canvas → edit props → save →
      `/pages/<pageId>` renders.

---

## 10. Where to look for examples

| If you're building… | Read this block |
| :--- | :--- |
| A simple stateless renderer | `heading-block.tsx`, `text-block.tsx` |
| A primitive wrapper | `divider-block.tsx`, `alert-block.tsx` |
| A heavy dynamic-import block | `chart-block.tsx`, `map-block.tsx` |
| A layout with React children | `card-block.tsx`, `grid-block.tsx` |
| A layout with id-keyed children | `tabs-block.tsx`, `accordion-block.tsx` |
| A block that wraps existing CRUD | `table-block.tsx` (wraps `ConfigDrivenListPage`) |
