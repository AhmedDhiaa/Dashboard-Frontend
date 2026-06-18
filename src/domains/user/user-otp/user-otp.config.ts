/**
 * User OTP Entity Configuration
 */

import { Key } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
import { entity } from "@/infra/api/backend"
import { getUserOtpSchema, type UserOtpFormValues } from "@/domains/user/user-otp/user-otp.schema"

interface UserOTP {
  id: number
  [key: string]: unknown
}
const userOTPService = entity<UserOTP>("/user-otp")

export const userOTPConfig: EntityConfig<UserOTP, UserOtpFormValues> = {
  entityName: "user-otp",
  singularName: "User OTP",
  pluralName: "User OTPs",
  icon: Key,
  service: userOTPService,
  permissionKey: "Api.UserOneTimePassword",
  basePath: "/user-otp",

  listColumns: [
    { field: "user", type: "text-primary" },
    { field: "otp", type: "text-secondary" },
    { field: "expiresAt", type: "datetime" },
    { field: "used", type: "boolean" },
  ],

  defaultSort: { field: "expiresAt", direction: "desc" },
  searchFields: ["user", "otp"],
  defaultPageSize: 10,

  detailSections: [
    {
      title: "primary_information",
      fields: [
        { name: "user", type: "text-primary", labelKey: "pages.user" },
        { name: "otp", type: "text-secondary", labelKey: "pages.otp" },
        { name: "expiresAt", type: "datetime", labelKey: "pages.expiresAt" },
        { name: "used", type: "boolean", labelKey: "pages.used" },
        { name: "note", type: "text-secondary", labelKey: "pages.note", condition: entity => !!entity.note },
      ],
    },
  ],

  formFields: {
    user: { type: "text", labelKey: "pages.user", required: false },
    otp: { type: "text", labelKey: "pages.otp", required: true },
    expiresAt: { type: "datetime", labelKey: "pages.expiresAt", required: false },
    used: { type: "boolean", labelKey: "pages.used", required: false },
    note: { type: "textarea", labelKey: "pages.note", required: false },
    concurrencyStamp: { type: "text", hidden: true },
  },

  formFieldOrder: ["user", "otp", "expiresAt", "used", "note"],
  excludeFields: ["concurrencyStamp"],
  createSchema: getUserOtpSchema,
  updateSchema: getUserOtpSchema,

  defaultFormValues: { user: "", otp: "", expiresAt: "", used: false, note: "" },

  entityToFormData: (userOTP: UserOTP) => ({
    user: (userOTP.user as string) || "",
    otp: (userOTP.otp as string) || "",
    expiresAt: (userOTP.expiresAt as string) || "",
    used: (userOTP.used as boolean) || false,
    note: (userOTP.note as string) || "",
    concurrencyStamp: userOTP.concurrencyStamp as string,
  }),

  translations: {
    listTitle: "pages.userOTP.title",
    listDescription: "pages.userOTP.description",
    detailTitle: "pages.userOTP.detail_title",
    createTitle: "pages.userOTP.create_title",
    editTitle: "pages.userOTP.edit_title",
    searchPlaceholder: "pages.userOTP.searchPlaceholder",
  },

  features: { create: true, edit: true, delete: true, export: true },
}
