"use client"
// Calls useT()/useLocale() — required to be a Client Component.
// Enforced by scripts/check-rsc-boundaries.mjs.

/**
 * Role Entity Configuration
 */

import { Shield, Users } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
import { roleService } from "./role.service"
import { getRoleSchema, type RoleFormValues } from "@/domains/system/role/role.schema"
import type { IdentityRole } from "@/shared/types/security.types"
import { PermissionButton } from "@/domains/system/security/components/PermissionButton"
import { RoleMembersList } from "./components/RoleMembersList"
import { useT } from "@/shared/config"

const RoleMembersTitle = () => {
  const t = useT()
  return <h3 className="text-lg font-bold">{t("pages.role.members")}</h3>
}

export const roleConfig: EntityConfig<IdentityRole, RoleFormValues> = {
  entityName: "role",
  singularName: "Role",
  pluralName: "Roles",
  icon: Shield,
  service: roleService,
  permissionKey: "AbpIdentity.Roles",
  basePath: "/roles",

  listColumns: [
    { field: "name", type: "text-primary", titleKey: "pages.name" },
    {
      field: "permissions",
      type: "custom",
      width: 80,
      config: {
        customRender: (_value, row) => (
          <div className="flex justify-center">
            <PermissionButton providerName="R" providerKey={row.name} variant="ghost" size="icon" />
          </div>
        ),
      },
    },
    { field: "isDefault", type: "boolean", titleKey: "pages.isDefault", width: 100 },
    { field: "isPublic", type: "boolean", titleKey: "pages.isPublic", width: 100 },
    { field: "isStatic", type: "boolean", titleKey: "pages.isStatic", width: 100 },
    { field: "creationTime", type: "datetime", titleKey: "pages.creationTime" },
  ],

  defaultSort: { field: "creationTime", direction: "desc" },
  searchFields: ["name"],
  defaultPageSize: 10,
  // The ABP Identity Roles endpoint uses `Filter` (not `Term`) for search.
  searchParam: "Filter",

  detailSections: [
    {
      title: "primary_information",
      fields: [
        { name: "name", type: "text-primary", labelKey: "pages.name" },
        { name: "isDefault", type: "boolean", labelKey: "pages.isDefault" },
        { name: "isPublic", type: "boolean", labelKey: "pages.isPublic" },
        { name: "isStatic", type: "boolean", labelKey: "pages.isStatic" },
        { name: "concurrencyStamp", type: "text-primary", labelKey: "pages.concurrencyStamp", condition: () => false },
      ],
    },
    {
      title: "metadata",
      fields: [{ name: "creationTime", type: "datetime", labelKey: "pages.creationTime" }],
    },
  ],

  customDetailSections: (entity: IdentityRole) => (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Users className="h-5 w-5 text-primary" />
        <RoleMembersTitle />
      </div>
      <RoleMembersList roleName={entity.name} />
    </div>
  ),

  formFields: {
    name: {
      type: "text",
      labelKey: "pages.name",
      required: true,
      validation: { minLength: 1, maxLength: 256 },
    },
    isDefault: {
      type: "boolean",
      labelKey: "pages.isDefault",
      defaultValue: false,
    },
    isPublic: {
      type: "boolean",
      labelKey: "pages.isPublic",
      defaultValue: true,
    },
    concurrencyStamp: { type: "text", hidden: true },
  },

  formFieldOrder: ["name", "isDefault", "isPublic"],
  excludeFields: ["id", "isStatic", "creationTime"],

  createSchema: getRoleSchema,
  updateSchema: getRoleSchema,

  defaultFormValues: {
    name: "",
    isDefault: false,
    isPublic: true,
  },

  entityToFormData: (role: IdentityRole) => ({
    name: role.name,
    isDefault: role.isDefault,
    isPublic: role.isPublic,
    concurrencyStamp: role.concurrencyStamp,
  }),

  translations: {
    listTitle: "pages.role.title",
    listDescription: "pages.role.description",
    detailTitle: "pages.role.detail_title",
    createTitle: "pages.role.create_title",
    editTitle: "pages.role.edit_title",
    searchPlaceholder: "pages.role.searchPlaceholder",
    successCreate: "pages.role.create_success",
    successUpdate: "pages.role.update_success",
    successDelete: "pages.role.delete_success",
  },

  features: {
    create: true,
    edit: true,
    delete: true,
    view: true,
    export: true,
  },
}
