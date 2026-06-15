import { z } from "zod"
import { getNameField } from "@/core/entities/schema-common"

import type { TFunction } from "@/core/entities/schema-types"

export const getRoleSchema = (_t: TFunction) =>
  z.object({
    name: getNameField(),
    isDefault: z.boolean().default(false),
    isPublic: z.boolean().default(true),
    concurrencyStamp: z.string().optional().nullable(),
  })

export type RoleFormValues = z.infer<ReturnType<typeof getRoleSchema>>
