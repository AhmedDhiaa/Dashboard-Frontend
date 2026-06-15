import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { PagePermissionGuard } from "../PagePermissionGuard"

// Hoisted state — referenced from inside vi.mock factories, which run before
// top-level `const` declarations would be initialized.
const { permState, mockReplace } = vi.hoisted(() => ({
  permState: { granted: new Set<string>(), isAdmin: false },
  mockReplace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
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

// Override the global setup.ts mock (which always returns admin permissions).
// Drives `useEntityPermissions` from `permState` so each test can simulate a
// specific user's granted permission set.
vi.mock("@/core/auth/context/PermissionContext", () => ({
  useEntityPermissions: (permissionKey: string | undefined) => {
    if (permState.isAdmin) return { canView: true, canCreate: true, canUpdate: true, canDelete: true }
    if (!permissionKey) return { canView: false, canCreate: false, canUpdate: false, canDelete: false }
    return {
      canView: permState.granted.has(permissionKey),
      canCreate: permState.granted.has(`${permissionKey}.Create`),
      canUpdate: permState.granted.has(`${permissionKey}.Update`),
      canDelete: permState.granted.has(`${permissionKey}.Delete`),
    }
  },
}))

vi.mock("@/core/entities/hooks", () => ({
  useEntityConfig: (entityName: string) => {
    if (entityName === "city") {
      return {
        config: { entityName: "city", permissionKey: "Api.City" },
        isLoading: false,
        error: null,
      }
    }
    if (entityName === "loading-entity") {
      return { config: null, isLoading: true, error: null }
    }
    return { config: null, isLoading: false, error: null }
  },
}))

// Replace the real DataTableSkeleton (which pulls a heavy UI subtree) with a
// minimal stand-in so we can assert on a stable test id when access is denied.
vi.mock("@/ui/skeletons/DataTableSkeleton", () => ({
  DataTableSkeleton: () => <div data-testid="skeleton" />,
}))

describe("PagePermissionGuard", () => {
  beforeEach(() => {
    permState.granted = new Set<string>()
    permState.isAdmin = false
    mockReplace.mockClear()
  })

  it("renders children when a non-admin user has Api.City.Update granted (entityName='city')", () => {
    // The bug: with the old code, the guard would check "city.Update" against
    // the granted set — which contains "Api.City.Update" — and always fail.
    // After the fix, the guard resolves entityName "city" → "Api.City" via the
    // entity config and the check succeeds.
    permState.granted = new Set(["Api.City.Update"])

    render(
      <PagePermissionGuard entityName="city" action="update">
        <div data-testid="protected">Edit City Form</div>
      </PagePermissionGuard>,
    )

    expect(screen.getByTestId("protected")).toBeInTheDocument()
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("redirects to /403 when a non-admin user is missing the required permission", () => {
    permState.granted = new Set(["Api.City"]) // view-only, no update

    render(
      <PagePermissionGuard entityName="city" action="update">
        <div data-testid="protected">Edit City Form</div>
      </PagePermissionGuard>,
    )

    expect(screen.queryByTestId("protected")).not.toBeInTheDocument()
    expect(mockReplace).toHaveBeenCalledWith("/403")
  })

  it("does not redirect while the entity config is still loading", () => {
    // While async config resolution is in flight the guard must hold off on
    // /403 redirects — otherwise users get bounced before the real key is known.
    permState.granted = new Set(["Api.City.Update"])

    render(
      <PagePermissionGuard entityName="loading-entity" action="update">
        <div data-testid="protected">Edit Form</div>
      </PagePermissionGuard>,
    )

    expect(screen.queryByTestId("protected")).not.toBeInTheDocument()
    expect(screen.getByTestId("skeleton")).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("admin bypasses the permission check", () => {
    permState.isAdmin = true

    render(
      <PagePermissionGuard entityName="city" action="delete">
        <div data-testid="protected">Admin View</div>
      </PagePermissionGuard>,
    )

    expect(screen.getByTestId("protected")).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
