import { z } from "zod"
import { getOptionalString } from "@/core/entities/schema-common"

import type { TFunction } from "@/core/entities/schema-types"
export const getEnumSchema = (_t: TFunction) =>
  z.object({
    key: z.string().min(1, "Key is required"),
    value: getOptionalString(),
    status: getOptionalString(),
    note: getOptionalString(),
    concurrencyStamp: z.string().optional(),
  })

export type EnumFormValues = z.infer<ReturnType<typeof getEnumSchema>>
