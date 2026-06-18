/**
 * Enum Entity Configuration
 */

import { List } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
import { entity } from "@/infra/api/backend"
import { getEnumSchema, type EnumFormValues } from "@/domains/system/enum/enum.schema"

interface Enum {
  id: number
  [key: string]: unknown
}
const enumService = entity<Enum>("/enum")

export const enumConfig: EntityConfig<Enum, EnumFormValues> = {
  entityName: "enum",
  singularName: "Enum",
  pluralName: "Enums",
  icon: List,
  service: enumService,
  permissionKey: "Api.Enum",
  basePath: "/enums",

  listColumns: [
    { field: "key", type: "badge-code" },
    { field: "value", type: "text-primary" },
    { field: "status", type: "text-secondary" },
  ],

  defaultSort: { field: "key", direction: "asc" },
  searchFields: ["key", "value", "status"],
  defaultPageSize: 10,

  detailSections: [
    {
      title: "primary_information",
      fields: [
        { name: "key", type: "badge-code", labelKey: "pages.key" },
        { name: "value", type: "text-primary", labelKey: "pages.value" },
        { name: "status", type: "text-secondary", labelKey: "pages.status" },
        { name: "note", type: "text-secondary", labelKey: "pages.note", condition: entity => !!entity.note },
      ],
    },
  ],

  formFields: {
    key: { type: "text", labelKey: "pages.key", required: true },
    value: { type: "text", labelKey: "pages.value", required: false },
    status: { type: "text", labelKey: "pages.status", required: false },
    note: { type: "textarea", labelKey: "pages.note", required: false },
    concurrencyStamp: { type: "text", hidden: true },
  },

  formFieldOrder: ["key", "value", "status", "note"],
  excludeFields: ["concurrencyStamp"],
  createSchema: getEnumSchema,
  updateSchema: getEnumSchema,

  defaultFormValues: { key: "", value: "", status: "", note: "" },

  entityToFormData: (enumEntity: Enum) => ({
    key: (enumEntity.key as string) || "",
    value: (enumEntity.value as string) || "",
    status: (enumEntity.status as string) || "",
    note: (enumEntity.note as string) || "",
    concurrencyStamp: enumEntity.concurrencyStamp as string,
  }),

  translations: {
    listTitle: "pages.enum.title",
    listDescription: "pages.enum.description",
    detailTitle: "pages.enum.detail_title",
    createTitle: "pages.enum.create_title",
    editTitle: "pages.enum.edit_title",
    searchPlaceholder: "pages.enum.searchPlaceholder",
  },

  features: { create: true, edit: true, delete: true, export: true },
}
