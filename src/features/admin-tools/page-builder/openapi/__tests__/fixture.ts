import type { OpenAPIV3 } from "openapi-types"

/**
 * ABP-flavoured swagger fixture — small enough to be readable, large enough
 * to exercise list/create/detail/update/delete + custom action + ABP's
 * `PagedResultDto` envelope around the list response.
 *
 * Five resource clusters (orders, users, invoices, products, suppliers)
 * cover the user's "5+ resources" acceptance test for Phase 5.
 */

const orderItem: OpenAPIV3.SchemaObject = {
  type: "object",
  required: ["id", "code"],
  properties: {
    id: { type: "string", format: "uuid" },
    code: { type: "string" },
    name: { type: "string" },
    totalAmount: { type: "number" },
    status: { type: "string", enum: ["open", "closed", "cancelled"] },
    creationTime: { type: "string", format: "date-time" },
  },
}

const orderCreate: OpenAPIV3.SchemaObject = {
  type: "object",
  required: ["code", "name"],
  properties: {
    code: { type: "string", maxLength: 32 },
    name: { type: "string", maxLength: 200 },
    description: { type: "string" },
    password: { type: "string", format: "password" },
    phoneNumber: { type: "string" },
    email: { type: "string", format: "email" },
    color: { type: "string" },
    latitude: { type: "number" },
  },
}

function pagedResult(itemRefName: string): OpenAPIV3.SchemaObject {
  return {
    type: "object",
    properties: {
      items: { type: "array", items: { $ref: `#/components/schemas/${itemRefName}` } },
      totalCount: { type: "integer" },
    },
  }
}

function crudPaths(base: string, itemRefName: string, createRefName: string): OpenAPIV3.PathsObject {
  return {
    [base]: {
      get: {
        operationId: `list_${itemRefName}`,
        responses: {
          "200": { description: "ok", content: { "application/json": { schema: pagedResult(itemRefName) } } },
        },
      },
      post: {
        operationId: `create_${itemRefName}`,
        requestBody: { content: { "application/json": { schema: { $ref: `#/components/schemas/${createRefName}` } } } },
        responses: { "200": { description: "ok" } },
      },
    },
    [`${base}/{id}`]: {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: { operationId: `detail_${itemRefName}`, responses: { "200": { description: "ok" } } },
      put: {
        operationId: `update_${itemRefName}`,
        requestBody: { content: { "application/json": { schema: { $ref: `#/components/schemas/${createRefName}` } } } },
        responses: { "200": { description: "ok" } },
      },
      delete: { operationId: `delete_${itemRefName}`, responses: { "204": { description: "ok" } } },
    },
  }
}

export const ABP_FIXTURE: OpenAPIV3.Document = {
  openapi: "3.0.1",
  info: { title: "Acme API", version: "1.0" },
  paths: {
    ...crudPaths("/api/app/order", "OrderDto", "OrderCreateDto"),
    "/api/app/order/{id}/close": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      post: { operationId: "close_order", responses: { "200": { description: "ok" } } },
    },
    ...crudPaths("/api/app/user", "UserDto", "UserCreateDto"),
    ...crudPaths("/api/app/invoice", "InvoiceDto", "InvoiceCreateDto"),
    ...crudPaths("/api/app/product", "ProductDto", "ProductCreateDto"),
    ...crudPaths("/api/app/supplier", "SupplierDto", "SupplierCreateDto"),
  },
  components: {
    schemas: {
      OrderDto: orderItem,
      OrderCreateDto: orderCreate,
      UserDto: orderItem,
      UserCreateDto: orderCreate,
      InvoiceDto: orderItem,
      InvoiceCreateDto: orderCreate,
      ProductDto: orderItem,
      ProductCreateDto: orderCreate,
      SupplierDto: orderItem,
      SupplierCreateDto: orderCreate,
    },
  },
}
