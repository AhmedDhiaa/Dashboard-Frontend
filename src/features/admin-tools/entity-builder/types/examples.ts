/**
 * Reference example schemas. Tested for round-trip integrity in
 * `__tests__/builder-schema.test.ts`.
 *
 * Kept in `types/` rather than `examples/` so the same module tree owning
 * the schema also owns its known-good fixtures.
 */

import type { EntityBuilderSchema } from "./builder-schema"

export const customerExample: EntityBuilderSchema = {
  entityName: "customer",
  entityNamePlural: "customers",
  domain: "business",
  endpoint: "/api/app/customer",
  permissionKey: "Api.Customer",
  translations: {
    en: { title: "Customers", description: "Manage customers", searchPlaceholder: "Search customers…" },
    ar: { title: "العملاء", description: "إدارة العملاء", searchPlaceholder: "ابحث عن عميل…" },
  },
  fields: [
    {
      name: "code",
      type: "string",
      label: { en: "Code", ar: "الرمز" },
      required: true,
      validation: { minLength: 1, maxLength: 20, pattern: "^[A-Z0-9-]+$" },
    },
    {
      name: "name",
      type: "string",
      label: { en: "Name", ar: "الاسم" },
      required: true,
      validation: { maxLength: 100 },
    },
    { name: "email", type: "email", label: { en: "Email", ar: "البريد الإلكتروني" } },
    { name: "phone", type: "phone", label: { en: "Phone", ar: "الهاتف" } },
    { name: "isActive", type: "boolean", label: { en: "Active", ar: "نشط" } },
    {
      name: "cityId",
      type: "entity-autocomplete",
      label: { en: "City", ar: "المدينة" },
      entityRef: "city",
    },
  ],
  listColumns: [
    { field: "code", display: "badge-code", sortable: true, hidden: false },
    { field: "name", display: "text-primary", sortable: true, hidden: false },
    { field: "email", display: "text", sortable: true, hidden: false },
    { field: "isActive", display: "boolean", sortable: true, hidden: false },
  ],
  detailLayout: [
    {
      id: "primary",
      title: { en: "Primary info", ar: "المعلومات الأساسية" },
      fields: ["code", "name", "email", "phone"],
      collapsible: false,
    },
  ],
  formLayout: [{ fields: ["code", "name"] }, { fields: ["email", "phone"] }, { fields: ["cityId", "isActive"] }],
  features: { create: true, edit: true, delete: true, view: true, export: true, import: false },
}

export const invoiceExample: EntityBuilderSchema = {
  entityName: "invoice",
  entityNamePlural: "invoices",
  domain: "finance",
  endpoint: "/api/app/invoice",
  permissionKey: "Api.Invoice",
  translations: {
    en: { title: "Invoices" },
    ar: { title: "الفواتير" },
  },
  fields: [
    { name: "number", type: "string", label: { en: "Number", ar: "الرقم" }, required: true },
    { name: "issueDate", type: "date", label: { en: "Issue date", ar: "تاريخ الإصدار" }, required: true },
    {
      name: "status",
      type: "enum",
      label: { en: "Status", ar: "الحالة" },
      enumName: "InvoiceStatus",
    },
    {
      name: "customerId",
      type: "entity-autocomplete",
      label: { en: "Customer", ar: "العميل" },
      entityRef: "customer",
      required: true,
    },
    {
      name: "currency",
      type: "select",
      label: { en: "Currency", ar: "العملة" },
      options: [
        { value: "USD", labelKey: "Enum.Currency.USD" },
        { value: "IQD", labelKey: "Enum.Currency.IQD" },
        { value: "EUR", labelKey: "Enum.Currency.EUR" },
      ],
    },
    {
      name: "discountPercentage",
      type: "percentage",
      label: { en: "Discount", ar: "الخصم" },
      min: 0,
      max: 100,
      step: 0.5,
      // Only show the discount when status is 'draft' — the field-level
      // dependency exercises the cross-field reference checker.
      dependsOn: { field: "status", equals: "draft" },
    },
    { name: "totalAmount", type: "currency", label: { en: "Total", ar: "الإجمالي" }, readOnly: true },
    {
      name: "attachments",
      type: "file",
      label: { en: "Attachments", ar: "المرفقات" },
      accept: "application/pdf,image/*",
    },
  ],
  listColumns: [
    { field: "number", display: "badge-code", sortable: true, hidden: false },
    { field: "issueDate", display: "date", sortable: true, hidden: false },
    { field: "customerId", display: "text", sortable: true, hidden: false },
    { field: "totalAmount", display: "currency", sortable: true, hidden: false },
    { field: "status", display: "badge", sortable: true, hidden: false },
  ],
  detailLayout: [
    {
      id: "header",
      title: { en: "Header", ar: "الترويسة" },
      fields: ["number", "issueDate", "customerId", "currency"],
      collapsible: false,
    },
    {
      id: "totals",
      title: { en: "Totals", ar: "المجاميع" },
      fields: ["discountPercentage", "totalAmount"],
      collapsible: true,
    },
  ],
  formLayout: [
    { fields: ["number", "issueDate"] },
    { fields: ["customerId", "currency"] },
    { fields: ["discountPercentage"] },
    { fields: ["attachments"] },
  ],
  filters: [
    { field: "status", operator: "in", label: { en: "Status", ar: "الحالة" } },
    { field: "issueDate", operator: "between" },
  ],
  bulkActions: [
    { id: "export", label: { en: "Export selected", ar: "تصدير المحدد" }, action: "export", confirm: false },
    { id: "delete", label: { en: "Delete selected", ar: "حذف المحدد" }, action: "delete", confirm: true },
  ],
  features: { create: true, edit: true, delete: true, view: true, export: true, import: true },
}

export const orderExample: EntityBuilderSchema = {
  entityName: "order",
  entityNamePlural: "orders",
  domain: "business",
  endpoint: "/api/app/order",
  permissionKey: "Api.Order",
  translations: {
    en: { title: "Orders" },
    ar: { title: "الطلبات" },
  },
  fields: [
    { name: "reference", type: "string", label: { en: "Reference", ar: "المرجع" }, required: true },
    {
      name: "customerId",
      type: "api-autocomplete",
      label: { en: "Customer", ar: "العميل" },
      apiConfig: {
        endpoint: "/api/app/customer/lookup",
        queryParam: "q",
        itemsPath: "items",
        valueField: "id",
        labelField: "name",
        foreignLabelField: "foreignName",
      },
    },
    {
      name: "tags",
      type: "tags",
      label: { en: "Tags", ar: "الوسوم" },
    },
    {
      name: "color",
      type: "color",
      label: { en: "Highlight", ar: "اللون" },
    },
    {
      name: "deliveryNotes",
      type: "richtext",
      label: { en: "Delivery notes", ar: "ملاحظات التسليم" },
    },
  ],
  listColumns: [
    { field: "reference", display: "badge-code", sortable: true, hidden: false },
    { field: "customerId", display: "text", sortable: true, hidden: false },
    { field: "tags", display: "tags", sortable: false, hidden: false },
  ],
  detailLayout: [
    {
      id: "main",
      title: { en: "Order", ar: "الطلب" },
      fields: ["reference", "customerId", "tags", "deliveryNotes"],
      collapsible: false,
    },
  ],
  formLayout: [{ fields: ["reference", "customerId"] }, { fields: ["tags", "color"] }, { fields: ["deliveryNotes"] }],
  features: { create: true, edit: true, delete: true, view: true, export: false, import: false },
}
