/** Admin gate for theme-override routes. */

import { requirePermission } from "@/app/api/_lib/require-permission"
import { THEME_MANAGE_PERMISSION } from "./constants"

export const requireThemeAdmin = () => requirePermission(THEME_MANAGE_PERMISSION)
