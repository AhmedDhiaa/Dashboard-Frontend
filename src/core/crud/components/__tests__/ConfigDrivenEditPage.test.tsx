/**
 * Integration tests for ConfigDrivenEditPage.
 *
 * The component is a config loader + props mapper, same as ConfigDrivenListPage.
 * We mock `useEntityConfig` and the heavy `CRUDEditPage` child, then check
 * that the right title, schema, and create/edit-mode flag flow through.
 *
 * What we test:
 *   - Loading state renders a spinner, not the form.
 *   - Missing config renders the "configuration not found" message.
 *   - No id ⇒ create mode: title comes from `translations.createTitle`,
 *     successMessage falls back to the create message key.
 *   - With id ⇒ edit mode: title from `translations.editTitle`, successMessage
 *     falls back to the update message key.
 *   - Permission denied (no canCreate or canUpdate) redirects to /403.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const stubProps: { last?: Record<string, unknown> } = {}
const replaceMock = vi.fn()

vi.mock("@/core/entities/hooks", () => ({
  useEntityConfig: vi.fn(),
}))

// Capture every prop the heavy CRUDEditPage child receives.
vi.mock("../CRUDEditPage", () => ({
  CRUDEditPage: (props: Record<string, unknown>) => {
    stubProps.last = props
    return (
      <div data-testid="crud-edit-page-stub">
        <span data-testid="title">{String(props.title ?? "")}</span>
        <span data-testid="entity-name">{String(props.entityName ?? "")}</span>
      </div>
    )
  },
}))

// Layout components live behind LayoutRenderer; the wrapper test never
// reaches them because we stub CRUDEditPage. Mock SchemaFormRenderer for
// safety in case React traverses the renderForm callback.
vi.mock("../SchemaFormRenderer", () => ({
  SchemaFormRenderer: () => <div data-testid="schema-form-renderer-stub" />,
}))

// Override next/navigation to track router.replace (permission redirect path).
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Override the global PermissionContext mock per-test by re-mocking. The
// global mock returns admin permissions; tests that need denial flip a flag
// in `permState` before rendering.
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

import { ConfigDrivenEditPage } from "../ConfigDrivenEditPage"
import { useEntityConfig } from "@/core/entities/hooks"

// Test fixture — loosely-typed for variance reasons (lucide icon type,
// ColumnMetadata variance). Cast at call sites with `as never`.
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

describe("ConfigDrivenEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubProps.last = undefined
    replaceMock.mockClear()
    permState.canCreate = true
    permState.canUpdate = true
  })

  it("renders a spinner while the config is loading", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: null, isLoading: true, error: null })
    render(<ConfigDrivenEditPage entityConfigName="brand" />)
    expect(screen.queryByTestId("crud-edit-page-stub")).toBeNull()
  })

  it("renders the 'configuration not found' message when the registry has nothing", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: null, isLoading: false, error: null })
    render(<ConfigDrivenEditPage entityConfigName="missing-entity" />)
    // Test setup mocks `useT` to return the translation key — assertion
    // matches the i18n key, not the literal English string.
    expect(screen.getByText(/configuration_for_not_found/i)).toBeInTheDocument()
  })

  it("renders create mode with create-title when no id is given", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    render(<ConfigDrivenEditPage entityConfigName="brand" />)

    expect(screen.getByTestId("crud-edit-page-stub")).toBeInTheDocument()
    expect(stubProps.last).toMatchObject({
      entityName: "brand",
      title: "pages.brand.create_title",
      id: undefined,
      successMessage: "crud.messages.success_create",
    })
  })

  it("renders edit mode with edit-title when id is given", () => {
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    render(<ConfigDrivenEditPage entityConfigName="brand" id="42" />)

    expect(stubProps.last).toMatchObject({
      entityName: "brand",
      id: "42",
      title: "pages.brand.edit_title",
      successMessage: "crud.messages.success_update",
    })
  })

  it("redirects to /403 when the user lacks the create permission", () => {
    permState.canCreate = false
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    render(<ConfigDrivenEditPage entityConfigName="brand" />)

    expect(replaceMock).toHaveBeenCalledWith("/403")
    expect(screen.queryByTestId("crud-edit-page-stub")).toBeNull()
  })

  it("redirects to /403 when the user lacks the update permission", () => {
    permState.canUpdate = false
    vi.mocked(useEntityConfig).mockReturnValue({ config: brandConfig() as never, isLoading: false, error: null })
    render(<ConfigDrivenEditPage entityConfigName="brand" id="42" />)

    expect(replaceMock).toHaveBeenCalledWith("/403")
    expect(screen.queryByTestId("crud-edit-page-stub")).toBeNull()
  })
})
