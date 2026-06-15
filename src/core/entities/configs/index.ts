/**
 * Entity Configuration Registry
 *
 * Auto-registers all entity configurations on module load
 * This file is imported by the app layout to ensure configs are available
 */

// Re-export initialization
export { initializeEntityConfigs } from "./init"

// Re-export registry functions
export { getEntityConfig, getRegisteredEntities } from "../config-types"
