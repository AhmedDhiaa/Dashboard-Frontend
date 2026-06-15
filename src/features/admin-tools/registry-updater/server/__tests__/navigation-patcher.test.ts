/**
 * Navigation patcher: unit tests + collision contract.
 *
 * The fixture intentionally mirrors the real navigation.ts shape:
 *
 *   - Multiple groups, each with `titleKey`, `icon`, optional
 *     `requiredPermission`, and `items: [...]`.
 *   - A mix of one-line entries AND a multi-line entry with `subItems`.
 *   - Trailing-comma convention.
 *
 * That way "insert into the right group" exercises group-disambiguation
 * (titleKey + items: anchor) and "preserve subItems entries" exercises
 * the closing-bracket finder's tolerance of nested arrays.
 */

import { describe, expect, it } from "vitest"
import {
  applyNavigationPatch,
  NavGroupNotFoundError,
  NavHrefCollisionError,
  PatchFailedError,
} from "../navigation-patcher"

const FIXTURE = `import { Box } from "lucide-react"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const NAV_GROUPS = [
  {
    titleKey: "nav.inventory",
    icon: Box,
    items: [
      { titleKey: "nav.items", href: "/items", requiredPermission: "Api.Item" },
      { titleKey: "nav.brands", href: "/brands", requiredPermission: "Api.Brand" },
    ],
  },
  {
    titleKey: "nav.finance",
    icon: Box,
    items: [
      { titleKey: "nav.sales_invoices", href: "/sales-invoices", requiredPermission: "Api.SalesInvoice" },
      {
        titleKey: "nav.vouchers",
        href: "/payments",
        requiredPermission: "Api.Payment",
        subItems: [
          { titleKey: "nav.vouchers_receipt", href: "/receives", requiredPermission: "Api.Receive" },
        ],
      },
    ],
  },
]
`

describe("applyNavigationPatch — happy path", () => {
  it("inserts a new entry at the end of the target group's items[] before the closing ]", () => {
    const r = applyNavigationPatch(FIXTURE, {
      group: "nav.inventory",
      titleKey: "nav.categories",
      href: "/categories",
      requiredPermission: "Api.Category",
    })
    expect(r.changed).toBe(true)
    expect(r.content).toContain(
      `      { titleKey: "nav.categories", href: "/categories", requiredPermission: "Api.Category" },`,
    )
    // Existing entries preserved byte-for-byte.
    expect(r.content).toContain(`      { titleKey: "nav.items", href: "/items", requiredPermission: "Api.Item" },`)
    expect(r.content).toContain(`      { titleKey: "nav.brands", href: "/brands", requiredPermission: "Api.Brand" },`)
  })

  it("emits PERMISSIONS.X as an unquoted reference (not a string literal)", () => {
    const r = applyNavigationPatch(FIXTURE, {
      group: "nav.inventory",
      titleKey: "nav.products",
      href: "/products",
      requiredPermission: "PERMISSIONS.PRODUCT_VIEW",
    })
    expect(r.content).toMatch(/requiredPermission:\s*PERMISSIONS\.PRODUCT_VIEW(?!")/)
  })

  it("emits the icon name unquoted when provided", () => {
    const r = applyNavigationPatch(FIXTURE, {
      group: "nav.inventory",
      titleKey: "nav.products",
      href: "/products",
      icon: "Package",
    })
    expect(r.content).toMatch(/icon:\s*Package(?!")/)
  })

  it("inserts into the right group when multiple groups exist", () => {
    const r = applyNavigationPatch(FIXTURE, {
      group: "nav.finance",
      titleKey: "nav.receipts",
      href: "/receipts",
      requiredPermission: "Api.Receive",
    })
    // The receipts entry should land in nav.finance's block, after the
    // multi-line vouchers entry's closing brace.
    const linesAfterVouchers = r.content.slice(r.content.indexOf(`titleKey: "nav.vouchers"`))
    expect(linesAfterVouchers).toContain(`href: "/receipts"`)
  })
})

describe("applyNavigationPatch — idempotency / collisions", () => {
  it("is a no-op when the exact same entry already exists (same href + titleKey)", () => {
    const r = applyNavigationPatch(FIXTURE, {
      group: "nav.inventory",
      titleKey: "nav.brands",
      href: "/brands",
      requiredPermission: "Api.Brand",
    })
    expect(r.changed).toBe(false)
    expect(r.content).toBe(FIXTURE)
  })

  it("refuses when an entry with the same href exists with a different titleKey (collision)", () => {
    expect(() =>
      applyNavigationPatch(FIXTURE, {
        group: "nav.inventory",
        titleKey: "nav.different_label",
        href: "/brands",
      }),
    ).toThrow(NavHrefCollisionError)
  })

  it("refuses href collisions even when the existing entry is in a different group", () => {
    // /payments is in nav.finance — inserting into nav.inventory still collides.
    expect(() =>
      applyNavigationPatch(FIXTURE, {
        group: "nav.inventory",
        titleKey: "nav.something",
        href: "/payments",
      }),
    ).toThrow(NavHrefCollisionError)
  })

  it("refuses href collisions against entries nested under subItems", () => {
    // `/receives` is nested under nav.finance.vouchers.subItems[0].
    expect(() =>
      applyNavigationPatch(FIXTURE, {
        group: "nav.inventory",
        titleKey: "nav.x",
        href: "/receives",
      }),
    ).toThrow(NavHrefCollisionError)
  })
})

describe("applyNavigationPatch — group resolution", () => {
  it("surfaces the available group titleKeys when the target group is missing", () => {
    let captured: NavGroupNotFoundError | null = null
    try {
      applyNavigationPatch(FIXTURE, { group: "nav.nonexistent", titleKey: "nav.x", href: "/x" })
    } catch (e) {
      if (e instanceof NavGroupNotFoundError) captured = e
    }
    expect(captured).not.toBeNull()
    expect(captured!.available).toEqual(expect.arrayContaining(["nav.inventory", "nav.finance"]))
  })
})

describe("applyNavigationPatch — input validation", () => {
  it("refuses an href that doesn't start with /", () => {
    expect(() => applyNavigationPatch(FIXTURE, { group: "nav.inventory", titleKey: "nav.x", href: "brands" })).toThrow(
      PatchFailedError,
    )
  })

  it("refuses non-dotted-key titleKeys (must look like an i18n key)", () => {
    expect(() => applyNavigationPatch(FIXTURE, { group: "nav.inventory", titleKey: "Brands", href: "/x" })).toThrow(
      PatchFailedError,
    )
  })

  it("refuses requiredPermission values that don't match the Api.X or PERMISSIONS.X shape", () => {
    for (const bad of ["Custom.Foo", "api.brand", "PERMISSIONS.lowercase", "Api.X; rm -rf /"]) {
      expect(
        () =>
          applyNavigationPatch(FIXTURE, {
            group: "nav.inventory",
            titleKey: "nav.x",
            href: "/x",
            requiredPermission: bad,
          }),
        bad,
      ).toThrow(PatchFailedError)
    }
  })

  it("refuses an icon that isn't a PascalCase identifier", () => {
    expect(() =>
      applyNavigationPatch(FIXTURE, {
        group: "nav.inventory",
        titleKey: "nav.x",
        href: "/x",
        icon: "lower-case",
      }),
    ).toThrow(PatchFailedError)
  })
})
