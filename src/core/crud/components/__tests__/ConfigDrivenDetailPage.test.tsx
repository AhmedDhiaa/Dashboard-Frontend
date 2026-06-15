/**
 * Integration tests for ConfigDrivenDetailPage.
 *
 * Mock the config hook + the heavy CRUDDetailPage child, then check the
 * wiring: title from translations, entityName, basePath-derived edit/back
 * routes, and the disableEdit / disableDelete flags driven by permissions.
 *
 * What we test:
 *   - Loading state renders a spinner, not the detail view.
 *   - Missing config renders the "configuration not found" message.
 *   - Loaded config wires title, entityName, and routes correctly.
 *   - `disableDelete` is true when the user lacks delete permission.
 *   - `disableEdit` is true when the user lacks update permission.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const stubProps: { last?: Record<string, unknown> } = {}

vi.mock("@/core/entities/hooks", () => ({
  useEntityConfig: vi.fn(),
}))

vi.mock("../CRUDDetailPage", () => ({
  CRUDDetailPage: (props: Record<string, unknown>) => {
    stubProps.last = props
    return (
      <div data-testid="crud-detail-page-stub">
        <span data-testid="title">{String(props.title ?? "")}</span>
        <span data-testid="entity-name">{String(props.entityName ?? "")}</span>
      </div>
    )
  },
}))

vi.mock("../BaseDetailRenderer", () => ({
  BaseDetailRenderer: () => <div data-testid="base-detail-renderer-stub" />,
}))

const permState = { canCreate: true, canUpdate: true, canDelete: true, canView: true }
vi.mock("@/core/auth/context/PermissionContext", () => ({
  PermissionProvider: ({ children }: { children: React.ReactNode }) => children,
  PermissionContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
  usePermissionContext: () => ({
    grantedPermissions: new Set<string>(),
    isGranted: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
    getEntityPermissions: () => permState,
    getFieldPermissions: () => [],
    isAdmin: false,
    isLoading: false,
    settings: {},
    features: {},
    refreshPermissions: vi.fn(),
  }),
  useEntityPermissions: () => permState,
  useColumnPermissions: <T,>(cols: T[]) => cols,
  useFieldPermissions: () => [],
  useIsAdmin: () => false,
}))

import { ConfigDrivenDetailPage } from "../ConfigDrivenDetailPage"
import { useEntityConfig } from "@/core/entities/hooks"

// Test fixture — loosely-typed for variance reasons. Cast at call sites.
function brandConfig(): unknown {
  return {
    entityName: "brand",
    singularName: "Brand",
    pluralName: "Brands",
    icon: () => null,
    service: {
      getList: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      autocomplete: vi.fn(),
    } as never,
    basePath: "/brands",
    permissionKey: "Api.Brand",
    listColumns: [{ field: "name", type: "text-primary" }],
    detailSections: [{ titleKey: "primary", fields: [] }],
    formFields: { name: { type: "text", required: true } },
    formFieldOrder: ["name"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createSchema: () => ({ parse: (v: unknown) => v }) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateSchema: () => ({ parse: (v: unknown) => v }) as any,
    defaultFormValues: { name: "" },
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

describe("ConfigDrivenDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubProps.last = undefined
    permState.canUpdate = true
    permState.canDelete = true
  })

  it("renders a spinner while the config is loading", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: null, isLoading: true, error: null })
    render(<ConfigDrivenDetailPage entityConfigName="brand" id="1" />)
    expect(screen.queryByTestId("crud-detail-page-stub")).toBeNull()
  })

  it("renders the 'configuration not found' message when the registry has nothing", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: null, isLoading: false, error: null })
    render(<ConfigDrivenDetailPage entityConfigName="missing-entity" id="1" />)
    // Test setup mocks `useT` to return the translation key — assertion
    // matches the i18n key, not the literal English string.
    expect(screen.getByText(/configuration_for_not_found/i)).toBeInTheDocument()
  })

  it("forwards entity-config-driven props to CRUDDetailPage when loaded", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    render(<ConfigDrivenDetailPage entityConfigName="brand" id="42" />)

    expect(screen.getByTestId("crud-detail-page-stub")).toBeInTheDocument()
    expect(stubProps.last).toMatchObject({
      entityName: "brand",
      id: "42",
      title: "pages.brand.detail_title",
      backRoute: "/brands",
      editRoute: "/brands/42/edit",
      disableEdit: false,
      disableDelete: false,
    })
  })

  it("disables the delete button when the user lacks delete permission", () => {
    permState.canDelete = false
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    render(<ConfigDrivenDetailPage entityConfigName="brand" id="42" />)

    expect(stubProps.last?.disableDelete).toBe(true)
  })

  it("disables the edit button when the user lacks update permission", () => {
    permState.canUpdate = false
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    render(<ConfigDrivenDetailPage entityConfigName="brand" id="42" />)

    expect(stubProps.last?.disableEdit).toBe(true)
  })

  it("respects an explicit disableDelete prop", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    render(<ConfigDrivenDetailPage entityConfigName="brand" id="42" disableDelete />)

    expect(stubProps.last?.disableDelete).toBe(true)
  })
})
