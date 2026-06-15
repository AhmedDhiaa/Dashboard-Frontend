import { describe, expect, it } from "vitest"
import { pageSchema } from "../page-schema"

const minimalPage = {
  id: "orders-overview",
  version: "1.0",
  title: { en: "Orders", ar: "الطلبات" },
  permission: "Api.Order",
  blocks: [
    {
      id: "list",
      type: "table",
      dataSource: { type: "entity", entityName: "order" },
      columns: [{ field: "code", type: "badge-code" }],
    },
  ],
} as const

describe("pageSchema — happy path", () => {
  it("accepts a minimal page", () => {
    const parsed = pageSchema.parse(minimalPage)
    expect(parsed.layout).toBe("full")
  })

  it("accepts the spec §17 worked example (business-partners-list)", () => {
    expect(() =>
      pageSchema.parse({
        id: "business-partners-list",
        version: "1.0",
        title: { en: "Business Partners", ar: "الشركاء التجاريون" },
        permission: "Api.BusinessPartner",
        navigation: {
          enabled: true,
          group: "business",
          icon: "Briefcase",
          order: 30,
        },
        layout: "full",
        blocks: [
          {
            id: "list",
            type: "table",
            dataSource: { type: "entity", entityName: "business-partner" },
            pageSize: 10,
            searchable: true,
            searchFields: ["code", "name", "phoneInfo.number"],
            defaultSort: { field: "creationTime", direction: "desc" },
            columns: [
              { field: "code", type: "badge-code" },
              { field: "name", type: "text-primary" },
              { field: "type", type: "enum", config: { enumType: "business-partner-type" } },
              {
                field: "phoneInfo.number",
                type: "text-secondary",
                label: { en: "Phone", ar: "هاتف" },
              },
              { field: "creationTime", type: "datetime" },
            ],
            rowLink: "/business-partners/{id}",
            rowActions: [
              {
                id: "view",
                label: { en: "View", ar: "عرض" },
                icon: "Eye",
                variant: "ghost",
                position: "row",
                action: { type: "navigate", href: "/business-partners/{id}" },
              },
              {
                id: "edit",
                label: { en: "Edit", ar: "تعديل" },
                icon: "Pencil",
                variant: "ghost",
                position: "row",
                permission: "Api.BusinessPartner.Update",
                action: { type: "navigate", href: "/business-partners/{id}/edit" },
              },
              {
                id: "delete",
                label: { en: "Delete", ar: "حذف" },
                icon: "Trash",
                variant: "ghost",
                position: "row",
                permission: "Api.BusinessPartner.Delete",
                action: {
                  type: "api",
                  method: "DELETE",
                  endpoint: "/business-partner/{id}",
                  confirm: {
                    title: { en: "Delete partner?", ar: "حذف الشريك؟" },
                    message: { en: "This cannot be undone.", ar: "لا يمكن التراجع." },
                    destructive: true,
                  },
                  onSuccess: {
                    notify: { en: "Partner deleted", ar: "تم الحذف" },
                    refresh: true,
                  },
                },
              },
            ],
          },
        ],
      }),
    ).not.toThrow()
  })

  it("accepts lifecycle hooks (onMount + onError)", () => {
    expect(() =>
      pageSchema.parse({
        ...minimalPage,
        onMount: { type: "navigate", href: "/welcome" },
        onError: { type: "navigate", href: "/error" },
      }),
    ).not.toThrow()
  })
})

describe("pageSchema — failures", () => {
  it("rejects a missing permission", () => {
    const { permission: _omit, ...page } = minimalPage
    void _omit
    expect(() => pageSchema.parse(page)).toThrow()
  })

  it("rejects a non-1.0 version", () => {
    expect(() => pageSchema.parse({ ...minimalPage, version: "2.0" })).toThrow()
  })

  it("rejects an unknown layout value", () => {
    expect(() => pageSchema.parse({ ...minimalPage, layout: "fluid" })).toThrow()
  })

  it("rejects a permission missing the Api. namespace", () => {
    expect(() => pageSchema.parse({ ...minimalPage, permission: "AbpIdentity.Roles" })).toThrow()
  })

  it("rejects a non-kebab id", () => {
    expect(() => pageSchema.parse({ ...minimalPage, id: "OrdersOverview" })).toThrow()
  })
})
