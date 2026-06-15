import { z } from "zod"
import type { TFunction } from "@/core/entities/schema-types"

export const getNotificationCreateSchema = (t: TFunction) =>
  z.object({
    note: z
      .string()
      .max(500, t("errors.max_length", { max: 500 }))
      .optional(),
    type: z.number({ message: t("common.validation.required") }),
    title: z.string().min(1, t("common.validation.required")).max(200),
    body: z.string().min(1, t("common.validation.required")).max(2000),
    baseId: z.string().min(1, t("common.validation.required")),
    baseRef: z.string().min(1, t("common.validation.required")),
    baseEntityType: z.number().min(1, t("common.validation.required")),
    userInfo: z.object({
      id: z.string().uuid(t("common.validation.invalidFormat")),
    }),
  })

export const getNotificationUpdateSchema = (t: TFunction) =>
  getNotificationCreateSchema(t).extend({
    concurrencyStamp: z.string().min(1, t("common.validation.required")),
  })

export type NotificationFormValues = z.infer<ReturnType<typeof getNotificationCreateSchema>>
export type NotificationUpdateFormValues = z.infer<ReturnType<typeof getNotificationUpdateSchema>>
