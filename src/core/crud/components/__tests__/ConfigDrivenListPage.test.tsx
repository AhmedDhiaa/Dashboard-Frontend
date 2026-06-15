/**
 * Integration tests for ConfigDrivenListPage.
 *
 * Strategy: this component is a "config loader + props mapper" — its job is
 * to read the entity config via `useEntityConfig`, transform what it finds
 * into the prop shape `CRUDListPage` expects, and render. We mock the heavy
 * `CRUDListPage` child to a prop-capturing stub so we can assert on the
 * wiring without booting the real data table.
 *
 * What we test:
 *   - Loading state renders the data-table skeleton.
 *   - Missing config renders the not-found message.
 *   - Loaded config renders CRUDListPage with the right title, entityName,
 *     basePath-derived create route, and pageSize.
 *   - `disableCreate` is forwarded.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import type * as React from "react"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// ConfigDrivenListPage now calls useQueryClient (for refresh invalidation), so
// renders must be wrapped in a QueryClientProvider.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const renderWithQuery = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)

const stubProps: { last?: Record<string, unknown> } = {}

vi.mock("@/core/entities/hooks", () => ({
  useEntityConfig: vi.fn(),
}))

// DataTableSkeleton uses theme primitives that need a ThemeProvider — stub it
// to a marker so the loading-state branch is observable without a provider.
vi.mock("@/ui/skeletons/DataTableSkeleton", () => ({
  DataTableSkeleton: () => <div data-testid="data-table-skeleton" />,
}))

// `next/dynamic` resolves to the mocked CRUDListPage below; we stub it to
// capture every prop it receives so each test can introspect.
vi.mock("../CRUDListPage", () => ({
  CRUDListPage: (props: Record<string, unknown>) => {
    stubProps.last = props
    return (
      <div data-testid="crud-list-page-stub">
        <span data-testid="title">{String(props.title ?? "")}</span>
        <span data-testid="entity-name">{String(props.entityName ?? "")}</span>
      </div>
    )
  },
}))

// `next/dynamic` is awkward in jsdom — short-circuit it to import the
// mocked module synchronously.
vi.mock("next/dynamic", () => ({
  default: <T,>(loader: () => Promise<{ default: T }>) => {
    let resolved: T | null = null
    void loader().then(mod => {
      resolved = mod.default
    })
    // Return a wrapper that renders whatever the loader resolved to, falling
    // back to null while still loading. In jsdom + vitest the promise
    // resolves before the first microtask, so by the time the wrapper
    // renders, resolved is set.
    return function Dynamic(props: Record<string, unknown>) {
      if (!resolved) return null
      const C = resolved as unknown as (p: Record<string, unknown>) => React.ReactElement
      return <C {...props} />
    }
  },
}))

import { ConfigDrivenListPage } from "../ConfigDrivenListPage"
import { useEntityConfig } from "@/core/entities/hooks"

// Test fixture — the strict EntityConfig types are awkward in test mocks
// (the lucide icon type, ColumnMetadata variance). We return `unknown` and
// cast at call sites; this is a test-only escape hatch.
function brandConfig(): unknown {
  return {
    entityName: "brand",
    singularName: "Brand",
    pluralName: "Brands",
    icon: () => null,
    service: {
      getList: vi.fn(() => Promise.resolve({ items: [], totalCount: 0 })),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      autocomplete: vi.fn(),
    } as never,
    basePath: "/brands",
    permissionKey: "Api.Brand",
    listColumns: [
      { field: "code", type: "badge-code" },
      { field: "name", type: "text-primary" },
    ],
    detailSections: [{ titleKey: "primary", fields: [] }],
    formFields: { name: { type: "text", required: true } },
    formFieldOrder: ["name"],
    createSchema: () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({}) as any,
    updateSchema: () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({}) as any,
    defaultFormValues: { name: "" },
    defaultPageSize: 25,
    translations: {
      listTitle: "pages.brand.list_title",
      listDescription: "pages.brand.list_description",
      detailTitle: "pages.brand.detail_title",
      createTitle: "pages.brand.create_title",
      editTitle: "pages.brand.edit_title",
      searchPlaceholder: "pages.brand.search",
    },
    features: { create: true, edit: true, delete: true, view: true },
  }
}

describe("ConfigDrivenListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubProps.last = undefined
  })

  it("renders the skeleton while the config is loading", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: null, isLoading: true, error: null })
    renderWithQuery(<ConfigDrivenListPage entityConfigName="brand" />)
    expect(screen.getByTestId("data-table-skeleton")).toBeInTheDocument()
    expect(screen.queryByTestId("crud-list-page-stub")).toBeNull()
  })

  it("renders the 'configuration not found' message when the registry has nothing", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: null, isLoading: false, error: null })
    renderWithQuery(<ConfigDrivenListPage entityConfigName="missing-entity" />)
    // Test setup mocks `useT` to return the translation key — assertion
    // matches the i18n key, not the literal English string.
    expect(screen.getByText(/configuration_not_found/i)).toBeInTheDocument()
  })

  it("forwards entity-config-driven props to CRUDListPage when loaded", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    renderWithQuery(<ConfigDrivenListPage entityConfigName="brand" />)

    // The stub renders synchronously because next/dynamic was overridden.
    expect(screen.getByTestId("crud-list-page-stub")).toBeInTheDocument()
    expect(stubProps.last).toMatchObject({
      entityName: "brand",
      // The mocked useT returns its key as-is, so the title is the literal
      // translation key from the config.
      title: "pages.brand.list_title",
      defaultPageSize: 25,
      // basePath-derived create route.
      createRoute: "/brands/create/edit",
    })
  })

  it("propagates the disableCreate prop", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    renderWithQuery(<ConfigDrivenListPage entityConfigName="brand" disableCreate />)
    expect(stubProps.last?.disableCreate).toBe(true)
  })
})
