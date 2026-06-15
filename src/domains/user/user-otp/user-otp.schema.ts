import { z } from "zod"
import { getOptionalString } from "@/core/entities/schema-common"

import type { TFunction } from "@/core/entities/schema-types"
export const getUserOtpSchema = (_t: TFunction) =>
  z.object({
    user: getOptionalString(),
    otp: z.string().length(6, "OTP must be 6 characters"),
    expiresAt: z.string().optional(),
    used: z.boolean().default(false),
    note: getOptionalString(),
    concurrencyStamp: z.string().optional(),
  })

export type UserOtpFormValues = z.infer<ReturnType<typeof getUserOtpSchema>>
