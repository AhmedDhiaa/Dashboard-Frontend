/**
 * Notification Entity Configuration
 *
 * @strict @enterprise-grade
 * Complete configuration for Notification CRUD operations
 */

import { Bell } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
import {
  getNotificationCreateSchema,
  getNotificationUpdateSchema,
  type NotificationFormValues,
} from "./notification.schema"
import { notificationService, type Notification } from "./notification.service"
import { EnumBadge } from "@/ui/application/EnumBadge"
import { dateFromFilter, dateToFilter, termFilter } from "@/core/crud/filters/documentFilterFields"

export const notificationConfig: EntityConfig<Notification, NotificationFormValues> = {
  // ============================================================================
  // METADATA
  // ============================================================================

  entityName: "notification",
  singularName: "Notification",
  pluralName: "Notifications",
  icon: Bell,
  service: notificationService,
  permissionKey: "Api.Notification",
  basePath: "/notifications",

  // ============================================================================
  // LIST PAGE CONFIGURATION
  // ============================================================================

  listColumns: [
    {
      field: "type",
      type: "custom",
      titleKey: "pages.notification.type",
      config: {
        customRender: val => <EnumBadge enumType="notification-type" id={val as number} />,
      },
    },
    { field: "title", type: "text-primary", titleKey: "pages.notification.title_field" },
    { field: "body", type: "text-secondary", titleKey: "pages.notification.body" },
    { field: "note", type: "text-secondary", titleKey: "pages.notification.note" },
    { field: "baseRef", type: "text-secondary", titleKey: "pages.notification.baseRef" },
    {
      field: "baseEntityType",
      type: "custom",
      titleKey: "forms.baseEntityType",
      config: {
        customRender: val => <EnumBadge enumType="entity-type" id={val as number} />,
      },
    },
    { field: "userInfo", type: "relation", titleKey: "pages.notification.userInfo" },
    {
      field: "status",
      type: "custom",
      titleKey: "common.fields.status",
      config: {
        customRender: val => <EnumBadge enumType="status" id={val as number} />,
      },
    },
    { field: "creationTime", type: "date", titleKey: "pages.notification.creationTime" },
    { field: "edit", type: "button", titleKey: "common.edit", action: "edit" },
    { field: "show", type: "button", titleKey: "common.show", action: "show" },
  ],

  defaultSort: {
    field: "creationTime",
    direction: "desc",
  },

  searchFields: ["title", "message"],

  defaultPageSize: 10,

  filterFields: [
    { name: "Type", label: "pages.notification.type", type: "multi-select", enumType: "notification-type" },
    { name: "Status", label: "Enum:filters:status_label", type: "multi-select", enumType: "status" },
    dateFromFilter,
    dateToFilter,
    termFilter(),
  ],

  // ============================================================================
  // DETAIL PAGE CONFIGURATION
  // ============================================================================

  detailSections: [
    {
      titleKey: "pages.notification.detail_title",
      fields: [
        { name: "title", type: "text-primary", labelKey: "pages.notification.title_field" },
        { name: "body", type: "text-secondary", labelKey: "pages.notification.body" },
        { name: "type", type: "badge", labelKey: "pages.notification.type" },
        {
          name: "status",
          labelKey: "common.fields.status",
          render: val => <EnumBadge enumType="notification-status" id={val as number} />,
        },
        {
          name: "baseEntityType",
          labelKey: "forms.baseEntityType",
          render: val => <EnumBadge enumType="entity-type" id={val as number} />,
        },
        { name: "userInfo.id", type: "text-secondary", labelKey: "pages.notification.userInfo" },
      ],
    },
    "METADATA",
  ],

  // ============================================================================
  // FORM CONFIGURATION
  // ============================================================================

  formFields: {
    type: {
      type: "number",
      labelKey: "pages.notification.type",
      required: true,
    },
    title: {
      type: "text",
      labelKey: "pages.notification.title_field",
      required: true,
      validation: { maxLength: 200 },
    },
    body: {
      type: "textarea",
      labelKey: "pages.notification.body",
      required: true,
      validation: { maxLength: 2000 },
    },
    note: {
      type: "textarea",
      labelKey: "pages.notification.note",
      validation: { maxLength: 500 },
    },
    baseId: {
      type: "text",
      labelKey: "pages.notification.baseId",
      required: true,
    },
    baseRef: {
      type: "text",
      labelKey: "pages.notification.baseRef",
      required: true,
    },
    baseEntityType: {
      type: "select",
      labelKey: "forms.baseEntityType",
      required: true,
      options: [
        { value: 1, label: "Order" },
        { value: 2, label: "Receive" },
        { value: 3, label: "Return" },
        { value: 4, label: "Stock Entry" },
      ],
    },
    userInfo: {
      type: "custom",
      labelKey: "pages.notification.userInfo",
      required: true,
    },
  },

  formFieldOrder: ["title", "body", "type", "baseId", "baseRef", "baseEntityType", "userInfo", "note"],

  excludeFields: [],

  createSchema: getNotificationCreateSchema,
  updateSchema: getNotificationUpdateSchema,

  defaultFormValues: {
    note: "",
    type: 1,
    title: "",
    body: "",
    baseId: "",
    baseRef: "",
    baseEntityType: 1,
    userInfo: { id: "" },
  },

  // ============================================================================
  // TRANSFORMATION FUNCTIONS
  // ============================================================================

  entityToFormData: (notification: Notification) => ({
    note: notification.note || "",
    type: notification.type,
    title: notification.title,
    body: notification.body,
    baseId: notification.baseId,
    baseRef: notification.baseRef,
    baseEntityType: notification.baseEntityType,
    userInfo: notification.userInfo,
  }),

  // ============================================================================
  // TRANSLATIONS
  // ============================================================================

  translations: {
    listTitle: "nav.notifications",
    listDescription: "pages.notification.description",
    detailTitle: "pages.notification.detail_title",
    createTitle: "pages.notification.create_title",
    editTitle: "pages.notification.edit_title",
    searchPlaceholder: "pages.notification.searchPlaceholder",
    successCreate: "pages.notification.create_success",
    successUpdate: "pages.notification.update_success",
    successDelete: "pages.notification.delete_success",
  },

  // ============================================================================
  // FEATURE FLAGS
  // ============================================================================

  features: {
    create: true,
    edit: true,
    delete: true,
    export: true,
  },
}
