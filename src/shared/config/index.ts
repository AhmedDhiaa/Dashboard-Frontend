// Export from app (excluding Locale to avoid conflict)
export { config, type Theme, type ApiEndpoints, type OAuth2Config } from "./app"

// Export from env
export * from "./env"

// White-label brand identity (APP_NAME, BRAND_DOMAIN)
export * from "./brand"

// Export from routes
export * from "./routes"

// Export from i18n (this includes the Locale type we want to use)
export * from "./i18n"

// Export from performance
export * from "./performance"
