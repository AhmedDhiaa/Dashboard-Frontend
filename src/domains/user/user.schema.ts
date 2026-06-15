import { z } from "zod"
import { getNameField, getEmailField, getOptionalString, getBooleanField } from "@/core/entities/schema-common"

import type { TFunction } from "@/core/entities/schema-types"
export const getUserSchema = (_t: TFunction) =>
  z.object({
    name: getNameField(),
    surname: getOptionalString(),
    email: getEmailField(),
    phoneNumber: getOptionalString(),
    userName: getNameField(),
    password: getOptionalString().refine(val => !val || val.length >= 6, {
      message: "Password must be at least 6 characters",
    }),
    roleNames: z.array(z.string()).default([]),
    isActive: getBooleanField(),
  })

export type UserFormValues = z.infer<ReturnType<typeof getUserSchema>>
