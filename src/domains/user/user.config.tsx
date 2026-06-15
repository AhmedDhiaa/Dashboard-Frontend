/**
 * User Entity Configuration
 */

import { Users } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
import { userService } from "./user.service"
import { getUserSchema, type UserFormValues } from "@/domains/user/user.schema"
import { PermissionButton } from "@/domains/system/security/components/PermissionButton"
import { IdentityUser } from "./user.service"
import { UserRoleButton } from "./components/UserRoleButton"

export const userConfig: EntityConfig<IdentityUser, UserFormValues> = {
  entityName: "user",
  singularName: "User",
  pluralName: "Users",
  icon: Users,
  service: userService,
  permissionKey: "AbpIdentity.Users",
  basePath: "/users",

  listColumns: [
    { field: "userName", type: "text-primary", titleKey: "pages.userName" },
    { field: "email", type: "text-secondary", titleKey: "pages.email" },
    {
      field: "roles",
      type: "custom",
      width: 80,
      titleKey: "pages.roles",
      config: {
        customRender: (_value, row) => (
          <div className="flex justify-center">
            <UserRoleButton userId={row.id} userName={row.userName} variant="ghost" size="icon" />
          </div>
        ),
      },
    },
    {
      field: "permissions",
      type: "custom",
      width: 80,
      titleKey: "pages.permissions",
      config: {
        customRender: (_value: unknown, row: IdentityUser) => (
          <div className="flex justify-center">
            <PermissionButton providerName="U" providerKey={row.id} variant="ghost" size="icon" />
          </div>
        ),
      },
    },
    {
      field: "isActive",
      type: "boolean",
      titleKey: "pages.isActive",
      width: 100,
    },
    { field: "creationTime", type: "datetime", titleKey: "pages.creationTime" },
  ],

  defaultSort: { field: "creationTime", direction: "desc" },
  searchFields: ["userName", "email", "name", "surname"],
  defaultPageSize: 10,

  detailSections: [
    {
      title: "primary_information",
      fields: [
        { name: "userName", type: "text-primary", labelKey: "pages.userName" },
        { name: "email", type: "text-primary", labelKey: "pages.email" },
        { name: "name", type: "text-primary", labelKey: "pages.name" },
        { name: "surname", type: "text-primary", labelKey: "pages.surname" },
        { name: "phoneNumber", type: "text-secondary", labelKey: "pages.phoneNumber" },
        { name: "isActive", type: "boolean", labelKey: "pages.isActive" },
      ],
    },
    {
      title: "metadata",
      fields: [{ name: "creationTime", type: "datetime", labelKey: "pages.creationTime" }],
    },
  ],

  formFields: {
    userName: { type: "text", labelKey: "pages.userName", required: true },
    email: { type: "text", labelKey: "pages.email", required: true },
    password: { type: "password", labelKey: "pages.password", required: false },
    name: { type: "text", labelKey: "pages.name", required: false },
    surname: { type: "text", labelKey: "pages.surname", required: false },
    phoneNumber: { type: "text", labelKey: "pages.phoneNumber", required: false },
    isActive: { type: "boolean", labelKey: "pages.isActive", defaultValue: true },
  },

  formFieldOrder: ["userName", "email", "password", "name", "surname", "phoneNumber", "isActive"],
  excludeFields: ["id", "creationTime"],

  createSchema: getUserSchema,
  updateSchema: getUserSchema,

  defaultFormValues: {
    userName: "",
    email: "",
    password: "",
    name: "",
    surname: "",
    phoneNumber: "",
    roleNames: [],
    isActive: true,
  },

  entityToFormData: (user: IdentityUser) => ({
    userName: user.userName,
    email: user.email,
    name: user.name || "",
    surname: user.surname || "",
    phoneNumber: user.phoneNumber || "",
    roleNames: [], // Identity API doesn't return roleNames in the main user object
    isActive: user.isActive,
  }),

  translations: {
    listTitle: "pages.user.title",
    listDescription: "pages.user.description",
    detailTitle: "pages.user.detail_title",
    createTitle: "pages.user.create_title",
    editTitle: "pages.user.edit_title",
    searchPlaceholder: "pages.user.searchPlaceholder",
    successCreate: "pages.user.create_success",
    successUpdate: "pages.user.update_success",
    successDelete: "pages.user.delete_success",
  },

  features: {
    create: false,
    edit: false,
    delete: false,
    view: false,
    export: false,
  },
}
