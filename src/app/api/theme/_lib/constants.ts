import path from "node:path"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const THEME_FILE = path.join(process.cwd(), "messages", "_overrides", "theme.json")
export const THEME_MANAGE_PERMISSION = PERMISSIONS.THEME_MANAGE
