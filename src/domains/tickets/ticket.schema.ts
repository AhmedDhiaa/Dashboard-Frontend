import { z } from "zod"

import type { TFunction } from "@/core/entities/schema-types"
export const getTicketCreateSchema = (t: TFunction) =>
  z.object({
    title: z.string().min(1, t("common.validation.required")),
    note: z.string().optional(),
    userInfo: z.object({
      id: z.string().min(1, t("common.validation.required")),
    }),
    status: z.number().optional(),
  })

export const getTicketUpdateSchema = (t: TFunction) =>
  z.object({
    title: z.string().min(1, t("common.validation.required")),
    note: z.string().optional(),
    userInfo: z.object({
      id: z.string().min(1, t("common.validation.required")),
    }),
    concurrencyStamp: z.string().optional(),
    status: z.number().optional(),
  })
