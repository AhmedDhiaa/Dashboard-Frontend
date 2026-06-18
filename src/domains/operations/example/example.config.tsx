/**
 * Vehicle Park Entity Configuration
 * Domain: Operations
 */

import { ParkingCircle } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
import { entity } from "@/infra/api/backend"
import {
  getExampleCreateSchema,
  getExampleUpdateSchema,
  type ExampleFormValues,
} from "@/domains/operations/example/example.schema"
import type { Example } from "./example.types"
import { ExampleLocationField, ExampleBoundariesField } from "./example-renderers"

const exampleService = entity<Example>("/example")

export const exampleConfig: EntityConfig<Example, ExampleFormValues> = {
  entityName: "example",
  singularName: "Vehicle Park",
  pluralName: "Vehicle Parks",
  icon: ParkingCircle,
  service: exampleService,
  permissionKey: "Api.Example",
  basePath: "/example",

  listColumns: [
    { field: "name", type: "text-primary" },
    { field: "foreignName", type: "text-arabic" },
    { field: "address", type: "text-primary" },
    { field: "creationTime", type: "date" },
  ],

  defaultSort: { field: "creationTime", direction: "desc" },
  searchFields: ["name", "foreignName", "address"],
  defaultPageSize: 10,
  detailSections: [
    {
      titleKey: "nav.examples",
      fields: [
        { name: "name", labelKey: "pages.name" },
        { name: "foreignName", labelKey: "pages.foreignName" },
        { name: "address", labelKey: "pages.address" },
        { name: "note", labelKey: "pages.note" },
      ],
    },
    {
      titleKey: "pages.example.location_point",
      fields: [
        { name: "locationPoint.latitude", labelKey: "pages.example.latitude" },
        { name: "locationPoint.longitude", labelKey: "pages.example.longitude" },
        { name: "locationPoint.angle", labelKey: "pages.example.angle" },
      ],
    },
    "METADATA",
  ],

  formFields: {
    name: {
      type: "text",
      labelKey: "pages.name",
      required: true,
      validation: { maxLength: 200 },
      className: "text-start font-semibold",
    },
    foreignName: {
      type: "text",
      labelKey: "pages.foreignName",
      required: true,
      validation: { maxLength: 200 },
      className: "text-start",
    },
    address: {
      type: "textarea",
      labelKey: "pages.address",
      required: true,
      validation: { maxLength: 500 },
      className: "text-start",
    },
    note: {
      type: "textarea",
      labelKey: "pages.note",
      required: false,
      validation: { maxLength: 500 },
      className: "text-start",
    },
    locationPoint: {
      type: "custom",
      labelKey: "pages.example.location_point",
      required: true,
      customRender: ExampleLocationField,
    },
    boundaries: {
      type: "custom",
      labelKey: "pages.example.boundaries",
      required: true,
      customRender: ExampleBoundariesField,
    },
    concurrencyStamp: { type: "text", hidden: true },
  },

  formFieldOrder: ["name", "foreignName", "address", "note", "locationPoint", "boundaries"],

  formLayout: {
    type: "composition",
    rows: [
      {
        id: "row1",
        columns: 2,
        fields: ["name", "foreignName"],
      },
      {
        id: "row2",
        columns: 2,
        fields: ["address", "note"],
      },
      {
        id: "row3",
        columns: 1,
        fields: ["locationPoint"],
      },
      {
        id: "row4",
        columns: 1,
        fields: ["boundaries"],
      },
    ],
    gap: "2rem",
  },

  excludeFields: ["concurrencyStamp"],
  createSchema: getExampleCreateSchema,
  updateSchema: getExampleUpdateSchema,

  defaultFormValues: {
    name: "",
    foreignName: "",
    address: "",
    locationPoint: {
      longitude: 0,
      latitude: 0,
      angle: 0,
    },
    boundaries: [],
    note: "",
  },

  entityToFormData: (entity: Example) => ({
    name: entity.name,
    foreignName: entity.foreignName,
    address: entity.address,
    locationPoint: entity.locationPoint || { longitude: 0, latitude: 0, angle: 0 },
    boundaries: entity.boundaries || [],
    note: entity.note || "",
    concurrencyStamp: entity.concurrencyStamp,
  }),

  translations: {
    listTitle: "nav.examples",
    listDescription: "pages.example.description",
    detailTitle: "pages.example.detail_title",
    createTitle: "pages.example.create_title",
    editTitle: "pages.example.edit_title",
    searchPlaceholder: "pages.example.searchPlaceholder",
    successCreate: "pages.example.create_success",
    successUpdate: "pages.example.update_success",
    successDelete: "pages.example.delete_success",
  },

  features: {
    create: true,
    edit: true,
    delete: true,
    export: true,
  },
}
