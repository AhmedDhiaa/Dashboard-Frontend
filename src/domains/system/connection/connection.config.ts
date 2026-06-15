/**
 * Connection Entity Configuration
 */

import { Link } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
import { BaseCRUDService } from "@/infra/api"
import { getConnectionSchema, type ConnectionFormValues } from "@/domains/system/connection/connection.schema"

interface Connection {
  id: number
  [key: string]: unknown
}
const connectionService = new BaseCRUDService<Connection>("/connection")

export const connectionConfig: EntityConfig<Connection, ConnectionFormValues> = {
  entityName: "connection",
  singularName: "Connection",
  pluralName: "Connections",
  icon: Link,
  service: connectionService,
  permissionKey: "Api.Connection",
  basePath: "/connections",
  listColumns: [
    { field: "name", type: "text-primary" },
    { field: "type", type: "text-secondary" },
    { field: "host", type: "text-secondary" },
    { field: "database", type: "text-secondary" },
    { field: "isActive", type: "boolean" },
    { field: "status", type: "text-secondary" },
  ],

  defaultSort: { field: "name", direction: "asc" },
  searchFields: ["name", "type", "host", "database"],
  defaultPageSize: 10,

  detailSections: [
    {
      title: "primary_information",
      fields: [
        { name: "name", type: "text-primary", labelKey: "pages.name" },
        { name: "type", type: "text-secondary", labelKey: "pages.type" },
        { name: "host", type: "text-secondary", labelKey: "pages.host" },
        { name: "port", type: "number", labelKey: "pages.port" },
        { name: "database", type: "text-secondary", labelKey: "pages.database" },
        { name: "username", type: "text-secondary", labelKey: "pages.username" },
        { name: "isActive", type: "boolean", labelKey: "pages.isActive" },
        { name: "status", type: "text-secondary", labelKey: "pages.status" },
        { name: "note", type: "text-secondary", labelKey: "pages.note", condition: entity => !!entity.note },
      ],
    },
  ],

  formFields: {
    name: { type: "text", labelKey: "pages.name", required: true },
    type: { type: "text", labelKey: "pages.type", required: false },
    host: { type: "text", labelKey: "pages.host", required: false },
    port: { type: "number", labelKey: "pages.port", required: false },
    username: { type: "text", labelKey: "pages.username", required: false },
    password: { type: "text", labelKey: "pages.password", required: false },
    database: { type: "text", labelKey: "pages.database", required: false },
    connectionString: { type: "textarea", labelKey: "pages.connectionString", required: false },
    isActive: { type: "boolean", labelKey: "pages.isActive", required: false },
    status: { type: "text", labelKey: "pages.status", required: false },
    note: { type: "textarea", labelKey: "pages.note", required: false },
    concurrencyStamp: { type: "text", hidden: true },
  },

  formFieldOrder: [
    "name",
    "type",
    "host",
    "port",
    "username",
    "password",
    "database",
    "connectionString",
    "isActive",
    "status",
    "note",
  ],
  excludeFields: ["concurrencyStamp"],
  createSchema: getConnectionSchema,
  updateSchema: getConnectionSchema,

  defaultFormValues: {
    name: "",
    type: "api",
    host: "",
    port: 0,
    username: "",
    password: "",
    database: "",
    connectionString: "",
    isActive: false,
    status: "",
    note: "",
  },

  entityToFormData: (connection: Connection) => ({
    name: connection.name as string,
    type: ((connection.type as string) || "api") as "database" | "api" | "service" | "other",
    host: connection.host as string | undefined,
    port: connection.port as number | undefined,
    username: connection.username as string | undefined,
    password: connection.password as string | undefined,
    database: connection.database as string | undefined,
    connectionString: connection.connectionString as string | undefined,
    isActive: (connection.isActive as boolean) || false,
    status: connection.status as string | undefined,
    note: connection.note as string | undefined,
    concurrencyStamp: connection.concurrencyStamp as string,
  }),

  translations: {
    listTitle: "pages.connection.title",
    listDescription: "pages.connection.description",
    detailTitle: "pages.connection.detail_title",
    createTitle: "pages.connection.create_title",
    editTitle: "pages.connection.edit_title",
    searchPlaceholder: "pages.connection.searchPlaceholder",
  },

  features: { create: true, edit: true, delete: true, export: true },
}
