/**
 * Vehicle Park Schema
 * Domain: Operations
 *
 * Validation schema for vehicle parking/storage locations
 */

import { z } from "zod"
import type { TFunction } from "@/core/entities/schema-types"

const locationPointSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  angle: z.number().min(0).max(360),
})

export const getExampleCreateSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(1, t("common.validation.required")).max(200),
    foreignName: z.string().min(1, t("common.validation.required")).max(200),
    address: z.string().min(1, t("common.validation.required")).max(500),
    locationPoint: locationPointSchema,
    boundaries: z.array(locationPointSchema),
    note: z.string().max(500).optional(),
  })

export const getExampleUpdateSchema = (t: TFunction) =>
  getExampleCreateSchema(t).extend({
    concurrencyStamp: z.string().optional(),
  })

export type ExampleFormValues = z.infer<ReturnType<typeof getExampleCreateSchema>>
