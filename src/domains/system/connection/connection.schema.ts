import { z } from "zod"
import { commonFields, getOptionalString, getBooleanField } from "@/core/entities/schema-common"

import type { TFunction } from "@/core/entities/schema-types"
export const getConnectionSchema = (_t: TFunction) =>
  z.object({
    name: commonFields.name(),
    type: z.enum(["database", "api", "service", "other"]).default("api"),
    host: getOptionalString(),
    port: z.number().optional(),
    database: getOptionalString(),
    username: getOptionalString(),
    password: getOptionalString(),
    connectionString: getOptionalString(),
    status: getOptionalString(),
    note: commonFields.note(),
    isActive: getBooleanField(),
  })

export type ConnectionFormValues = z.infer<ReturnType<typeof getConnectionSchema>>
