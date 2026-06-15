import path from "node:path"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const OVERRIDES_DIR = path.join(process.cwd(), "messages", "_overrides")
export const VERSION_FILE = path.join(OVERRIDES_DIR, ".version")
export const MANAGE_PERMISSION = PERMISSIONS.TRANSLATION_MANAGE

export const SUPPORTED_LOCALES = ["en", "ar"] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
