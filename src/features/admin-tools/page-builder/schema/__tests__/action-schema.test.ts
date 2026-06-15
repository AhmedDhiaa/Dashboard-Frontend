import { describe, expect, it } from "vitest"
import { actionSchema, buttonSchema } from "../action-schema"

describe("actionSchema — api", () => {
  it("accepts a minimal api action", () => {
    expect(() =>
      actionSchema.parse({
        type: "api",
        method: "POST",
        endpoint: "/orders",
      }),
    ).not.toThrow()
  })

  it("accepts an api action with confirm + onSuccess + onError", () => {
    expect(() =>
      actionSchema.parse({
        type: "api",
        method: "DELETE",
        endpoint: "/orders/{id}",
        confirm: {
          title: { en: "Delete?", ar: "حذف؟" },
          message: { en: "This cannot be undone.", ar: "لا يمكن التراجع." },
          destructive: true,
        },
        onSuccess: {
          notify: { en: "Deleted", ar: "تم الحذف" },
          refresh: true,
        },
        onError: {
          notify: { en: "Failed", ar: "فشل" },
        },
      }),
    ).not.toThrow()
  })

  it("rejects an api action with an unknown HTTP method", () => {
    expect(() =>
      actionSchema.parse({
        type: "api",
        method: "TRACE",
        endpoint: "/orders",
      }),
    ).toThrow()
  })

  it("rejects an api action with an empty endpoint", () => {
    expect(() =>
      actionSchema.parse({
        type: "api",
        method: "GET",
        endpoint: "",
      }),
    ).toThrow()
  })
})

describe("actionSchema — navigate", () => {
  it("accepts a navigate action", () => {
    const parsed = actionSchema.parse({ type: "navigate", href: "/orders" })
    expect(parsed.type).toBe("navigate")
    if (parsed.type === "navigate") {
      expect(parsed.external).toBe(false)
    }
  })

  it("rejects an empty href", () => {
    expect(() => actionSchema.parse({ type: "navigate", href: "" })).toThrow()
  })
})

describe("actionSchema — dialog (recursive into blocks)", () => {
  it("accepts a dialog with a heading + form blocks", () => {
    expect(() =>
      actionSchema.parse({
        type: "dialog",
        title: { en: "Confirm", ar: "تأكيد" },
        blocks: [
          {
            id: "heading",
            type: "heading",
            text: { en: "Are you sure?", ar: "هل أنت متأكد؟" },
            level: 3,
          },
        ],
      }),
    ).not.toThrow()
  })

  it("rejects a dialog whose nested block has an unknown type", () => {
    expect(() =>
      actionSchema.parse({
        type: "dialog",
        title: { en: "X", ar: "س" },
        blocks: [{ id: "x", type: "not-a-real-block" }],
      }),
    ).toThrow()
  })
})

describe("actionSchema — drawer", () => {
  it("accepts a drawer with default side", () => {
    const parsed = actionSchema.parse({
      type: "drawer",
      title: { en: "Details", ar: "التفاصيل" },
      blocks: [],
    })
    if (parsed.type === "drawer") {
      expect(parsed.side).toBe("end")
    }
  })

  it("rejects an unknown side value", () => {
    expect(() =>
      actionSchema.parse({
        type: "drawer",
        title: { en: "X", ar: "س" },
        blocks: [],
        side: "diagonal",
      }),
    ).toThrow()
  })
})

describe("buttonSchema", () => {
  it("accepts a row delete button (the spec §7 example)", () => {
    expect(() =>
      buttonSchema.parse({
        id: "close-ticket",
        label: { en: "Close", ar: "إغلاق" },
        icon: "X",
        variant: "destructive",
        size: "sm",
        position: "row",
        permission: "Api.Ticket.Close",
        action: {
          type: "api",
          method: "POST",
          endpoint: "/tickets/{id}/close",
          confirm: {
            title: { en: "Close ticket?", ar: "إغلاق التذكرة؟" },
            message: { en: "This cannot be undone.", ar: "لا يمكن التراجع." },
            destructive: true,
          },
        },
        rowCondition: { field: "status", operator: "ne", value: "closed" },
      }),
    ).not.toThrow()
  })

  it("applies sensible defaults", () => {
    const parsed = buttonSchema.parse({
      id: "view",
      label: { en: "View", ar: "عرض" },
      position: "row",
      action: { type: "navigate", href: "/orders/{id}" },
    })
    expect(parsed.variant).toBe("default")
    expect(parsed.size).toBe("default")
    expect(parsed.hidden).toBe(false)
  })

  it("rejects an unknown position", () => {
    expect(() =>
      buttonSchema.parse({
        id: "x",
        label: { en: "X", ar: "س" },
        position: "header",
        action: { type: "navigate", href: "/x" },
      }),
    ).toThrow()
  })

  it("rejects an invalid id (non-kebab)", () => {
    expect(() =>
      buttonSchema.parse({
        id: "CloseTicket",
        label: { en: "X", ar: "س" },
        position: "row",
        action: { type: "navigate", href: "/x" },
      }),
    ).toThrow()
  })
})
