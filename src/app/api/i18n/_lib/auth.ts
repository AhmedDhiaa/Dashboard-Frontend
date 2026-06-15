/**
 * Admin gate for translation-override routes. Thin wrapper over the shared
 * permission helper so call sites read like intent.
 */

import { requirePermission } from "@/app/api/_lib/require-permission"
import { MANAGE_PERMISSION } from "./constants"

export const requireTranslationAdmin = () => requirePermission(MANAGE_PERMISSION)
