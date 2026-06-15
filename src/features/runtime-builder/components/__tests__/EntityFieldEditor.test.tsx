/**
 * EntityFieldEditor — UI smoke test for the per-type sub-editor dispatch.
 *
 * We don't render the full Radix Select dropdown (jsdom + Radix portals
 * make that flaky); instead we drive type changes by patching the field
 * prop directly and assert the right sub-editor surfaces for each type.
 */

import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { RuntimeField } from "../../types"

// The whole design-system primitives chain (Button, Label, Input, etc.)
// reads from the global ThemeProvider. We don't care about theming here —
// the test only asserts which sub-editor surfaces for each field type — so
// stub `useTheme` with a no-op context. One mock covers every primitive.
vi.mock("@/ui/theme/ThemeManager", async () => {
  const actual = await vi.importActual<typeof import("@/ui/theme/ThemeManager")>("@/ui/theme/ThemeManager")
  return {
    ...actual,
    useTheme: () => ({
      theme: "light",
      resolvedTheme: "light",
      setTheme: () => {},
      systemTheme: "light",
      themes: ["light", "dark"],
      settings: {},
      updateSettings: () => {},
    }),
  }
})

// Stub the runtime config hook so the entity-autocomplete editor's
// dropdown has something to render. The component reads `entities` only.
vi.mock("../../store/provider-context", () => ({
  useRuntimeConfig: () => ({
    entities: [
      { id: "user", singularName: "User", pluralName: "Users" },
      { id: "team", singularName: "Team", pluralName: "Teams" },
    ],
    pages: [],
    dashboards: [],
    settings: { version: 0 },
  }),
  useRuntimeProvider: () => ({
    list: () => ({ items: [], totalCount: 0 }),
  }),
}))

// vi.mock is hoisted above this import at runtime, so a regular `import`
// here still sees the mocked theme + provider modules.
import { EntityFieldEditor } from "../EntityFieldEditor"

function baseField(): RuntimeField {
  return { key: "f", label: "F", type: "text" }
}

function renderField(field: RuntimeField) {
  return render(
    <EntityFieldEditor
      index={0}
      field={field}
      isFirst
      isLast
      canRemove={false}
      onChange={() => {}}
      onMove={() => {}}
      onRemove={() => {}}
      onMakeTitle={() => {}}
    />,
  )
}

describe("EntityFieldEditor: per-type sub-editor dispatch", () => {
  it("currency → renders currency code + locale inputs", () => {
    renderField({ ...baseField(), type: "currency", currencyConfig: { currencyCode: "EUR" } })
    expect(screen.getByText("Currency code")).toBeInTheDocument()
    expect(screen.getByText(/Locale \(optional\)/)).toBeInTheDocument()
  })

  it("image → renders accept-pattern + max-size inputs", () => {
    renderField({ ...baseField(), type: "image", fileConfig: { accept: ["image/*"], maxSizeKB: 2048 } })
    expect(screen.getByText("Accept patterns")).toBeInTheDocument()
    expect(screen.getByText("Max size (KB)")).toBeInTheDocument()
  })

  it("file → renders the same file-config row as image", () => {
    renderField({ ...baseField(), type: "file", fileConfig: { accept: ["application/pdf"] } })
    expect(screen.getByText("Accept patterns")).toBeInTheDocument()
    expect(screen.getByText("Max size (KB)")).toBeInTheDocument()
  })

  it("multi-select → renders the options editor (reuses select's editor)", () => {
    renderField({ ...baseField(), type: "multi-select", options: [{ value: "a", label: "Alpha" }] })
    expect(screen.getByText("Options")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Alpha")).toBeInTheDocument()
  })

  it("select → renders the options editor", () => {
    renderField({ ...baseField(), type: "select", options: [{ value: "x", label: "Xena" }] })
    expect(screen.getByText("Options")).toBeInTheDocument()
  })

  it("entity-autocomplete → renders target entity + display field inputs", () => {
    renderField({
      ...baseField(),
      type: "entity-autocomplete",
      entityAutocompleteConfig: { targetEntityName: "user", displayField: "fullName" },
    })
    expect(screen.getByText("Target entity")).toBeInTheDocument()
    expect(screen.getByText("Display field")).toBeInTheDocument()
    expect(screen.getByDisplayValue("fullName")).toBeInTheDocument()
  })

  it("boolean → does NOT render an options editor or per-type sub-row", () => {
    renderField({ ...baseField(), type: "boolean" })
    expect(screen.queryByText("Options")).not.toBeInTheDocument()
    expect(screen.queryByText("Currency code")).not.toBeInTheDocument()
    expect(screen.queryByText("Accept patterns")).not.toBeInTheDocument()
  })

  it("email / url / phone / color → no per-type sub-row (text-shaped only)", () => {
    for (const type of ["email", "url", "phone", "color"] as const) {
      const { unmount } = renderField({ ...baseField(), type })
      expect(screen.queryByText("Options")).not.toBeInTheDocument()
      expect(screen.queryByText("Currency code")).not.toBeInTheDocument()
      expect(screen.queryByText("Accept patterns")).not.toBeInTheDocument()
      unmount()
    }
  })
})
