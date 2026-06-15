// src/lib/config.ts
import { legacyEnv as env } from "./env"

export const config = {
  api: {
    baseUrl: env.api.baseUrl,
    timeout: 15000,
    oauth2: {
      tokenUrl: "/connect/token",
      authorizeUrl: "/connect/authorize",
      clientId: env.auth.clientId,
      scope: "profile offline_access email roles Api",
    },
    endpoints: {
      auth: {
        login: "/api/auth/login",
      },
    },
  },
  app: {
    name: "Acme Analytics",
    version: "1.1.0",
    defaultLocale: "ar" as const,
    supportedLocales: ["ar", "en"] as const,
    defaultTheme: "light" as const,
  },
  storageKeys: {
    theme: "theme" as const,
    locale: "locale" as const,
    userToken: "user_token" as const,
    refreshToken: "refresh_token" as const,
    clientToken: "client_token" as const,
    deviceId: "device_id" as const,
    rememberMe: "rememberMe" as const,
    entityData: "entity_data" as const,
    entityFetchTimestamp: "entity_fetch_timestamp" as const,
  },
  ui: {
    toastDuration: 5000,
    apiTimeout: 15000,
  },
  device: {
    defaultType: "WEB",
    defaultManufacturer: "Unknown",
    defaultOS: "Unknown",
  },
  maps: {
    apiKey: env.maps.googleApiKey,
    defaultCenter: { lat: 33.3152, lng: 44.3661 },
    defaultZoom: 10,
  },
  socket: {
    url: process.env.NEXT_PUBLIC_SOCKET_URL,
    transports: ["websocket", "polling"] as const,
  },
} as const

export type Theme = typeof config.app.defaultTheme | "dark"
export type ApiEndpoints = typeof config.api.endpoints
export type OAuth2Config = typeof config.api.oauth2
