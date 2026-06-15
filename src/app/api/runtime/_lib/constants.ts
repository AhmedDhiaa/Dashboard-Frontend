import path from "node:path"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

/**
 * On-disk layout for the runtime builder:
 *
 *   messages/_overrides/runtime/
 *     ├── config.json                  – RuntimeConfig (entities + pages + dashboards)
 *     ├── .version                     – integer, bumped on every config OR data write
 *     └── data/
 *         └── <entityId>.json          – RuntimeRecord[] for that entity
 *
 * We piggy-back on the existing `messages/_overrides` mount point so the
 * deployment story (volume mount in Docker, file permissions in IIS) is
 * already solved by the i18n-override workflow.
 */
export const RUNTIME_DIR = path.join(process.cwd(), "messages", "_overrides", "runtime")
export const RUNTIME_DATA_DIR = path.join(RUNTIME_DIR, "data")
export const RUNTIME_CONFIG_FILE = path.join(RUNTIME_DIR, "config.json")
export const RUNTIME_VERSION_FILE = path.join(RUNTIME_DIR, ".version")

/** Admin-only: write the schema (entities, pages, dashboards). */
export const RUNTIME_MANAGE_PERMISSION = PERMISSIONS.RUNTIME_MANAGE

/** Admin or data-writer: create / update / delete records. */
export const RUNTIME_WRITE_PERMISSION = PERMISSIONS.RUNTIME_WRITE

/** entityId is part of the URL path, so guard against traversal + bad chars. */
export function isValidEntityId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(value)
}
