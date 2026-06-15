import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { PageRenderer, PagePermissionGuardByKey } from "../PageRenderer"
import type { PageSchema } from "../../schema/page-schema"
import "../../registry/block-registry"

vi.mock("@/ui/theme/ThemeManager", () => ({
  useTheme: () => ({ settings: {} }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe("PagePermissionGuardByKey", () => {
  it("renders children when admin (mocked context returns isGranted=true)", () => {
    render(
      <PagePermissionGuardByKey permission="Api.Order">
        <span data-testid="guarded">visible</span>
      </PagePermissionGuardByKey>,
    )
    expect(screen.getByTestId("guarded")).toBeInTheDocument()
  })
})

describe("PageRenderer", () => {
  const baseSchema: PageSchema = {
    id: "test-page",
    version: "1.0",
    title: { en: "My Page", ar: "صفحتي" },
    description: { en: "Description here", ar: "وصف" },
    permission: "Api.Order",
    layout: "full",
    blocks: [
      {
        id: "title-h",
        type: "heading",
        text: { en: "Section title", ar: "عنوان" },
        level: 2,
        hidden: false,
      },
    ],
  } as never

  it("renders the page title from schema.title.en", () => {
    render(<PageRenderer schema={baseSchema} />)
    expect(screen.getByRole("heading", { level: 1, name: "My Page" })).toBeInTheDocument()
  })

  it("renders the optional description", () => {
    render(<PageRenderer schema={baseSchema} />)
    expect(screen.getByText("Description here")).toBeInTheDocument()
  })

  it("delegates each block to BlockRenderer", () => {
    render(<PageRenderer schema={baseSchema} />)
    expect(screen.getByRole("heading", { level: 2, name: "Section title" })).toBeInTheDocument()
  })

  it("applies the layout class", () => {
    const { container } = render(<PageRenderer schema={{ ...baseSchema, layout: "centered" }} />)
    expect(container.querySelector('[data-page-id="test-page"]')?.className).toMatch(/max-w-4xl/)
  })
})
