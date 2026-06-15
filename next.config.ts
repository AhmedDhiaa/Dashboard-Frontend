import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import { withSentryConfig } from "@sentry/nextjs"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

// White-label: the image allow-list is derived from the brand domain so a
// rebrand needs only NEXT_PUBLIC_BRAND_DOMAIN, not a code edit. The wildcard
// `*.<domain>` already covers api/api-dev/cdn subdomains. Keep in sync with
// src/shared/config/brand.ts (config can't import that TS module at load time).
const brandDomain = process.env.NEXT_PUBLIC_BRAND_DOMAIN?.trim() || "example.com"

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: `*.${brandDomain}` },
      // Localhost is only an allowed image source in non-production so prod
      // builds don't whitelist an http://localhost origin.
      ...(process.env.NODE_ENV !== "production"
        ? [{ protocol: "http" as const, hostname: "localhost" }]
        : []),
    ],
    formats: ["image/avif", "image/webp"],
  },

  // Security headers (non-CSP).
  //
  // **CSP lives in middleware.ts** — it owns the per-request `nonce` value
  // for `script-src 'nonce-...'` and is the single authoritative CSP
  // emitter. If we set Content-Security-Policy here too, the browser
  // would receive two headers and apply BOTH policies, intersecting them.
  // The static policy's `'unsafe-inline'` would NOT save the nonced
  // policy's nonce check (each policy is enforced independently), and
  // worse, the next.config.ts version would weaken Mozilla Observatory's
  // grade because it never carries the nonce.
  //
  // The non-CSP headers below DO ALSO appear in middleware (matched
  // routes get them twice; the duplicate is harmless and identical).
  // For unmatched paths (api JSON routes, `_next/static` chunks, image
  // assets) only this static block applies.
  async headers() {
    const isDev = process.env.NODE_ENV === "development"

    // HSTS: 2 years + includeSubDomains + preload. Only emit in
    // production — if a developer hits the dev server on localhost over
    // HTTPS once (e.g. a tunneled reverse proxy) the browser would
    // refuse to fall back to HTTP afterwards. Production deploys must
    // be HTTPS-only for this to be safe; if a future env terminates
    // TLS at a different layer, gate this on that env's flag instead.
    const hstsHeaders = isDev
      ? []
      : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]

    return [
      {
        source: "/(.*)",
        headers: [
          ...hstsHeaders,
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          // Stop search engines indexing API payloads.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          // Belt + suspenders against clickjacking via opener attacks.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
        ],
      },
    ]
  },

  // Optimize production builds
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-select",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "recharts",
      "framer-motion",
      "date-fns",
      "@tanstack/react-query",
      "@tanstack/react-table",
    ],
  },

  // Standalone output for containerized deployment
  output: "standalone",

  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,

  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.performance = {
        maxAssetSize: 1_000_000,
        maxEntrypointSize: 1_300_000,
        hints: "warning",
      }

      // Split heavy libraries into separate chunks so they're loaded on-demand
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          cacheGroups: {
            // exceljs — only loaded when user exports (replaced legacy `xlsx`
            // dep, which had unfixed prototype-pollution + ReDoS CVEs).
            exceljs: {
              test: /[\\/]node_modules[\\/]exceljs[\\/]/,
              name: "vendor-exceljs",
              chunks: "async" as const,
              priority: 30,
            },
            // recharts — only loaded on dashboard/report pages
            recharts: {
              test: /[\\/]node_modules[\\/](recharts|d3-[a-z-]+)[\\/]/,
              name: "vendor-recharts",
              chunks: "async" as const,
              priority: 25,
            },
            // framer-motion — only loaded where used
            framerMotion: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: "vendor-framer",
              chunks: "async" as const,
              priority: 20,
            },
            // Google Maps — only loaded on map pages
            googleMaps: {
              test: /[\\/]node_modules[\\/]@googlemaps[\\/]/,
              name: "vendor-maps",
              chunks: "async" as const,
              priority: 20,
            },
          },
        },
      }
    }
    return config
  },
}

// Bundle analyzer (only when ANALYZE=true). Kept synchronous so the export
// chain doesn't introduce top-level `await` — Next's config-loader uses
// `require()` which can't traverse an ESM graph with top-level await.
function withBundleAnalyzer(config: NextConfig): NextConfig {
  if (process.env.ANALYZE !== "true") return config
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const analyzer = require("@next/bundle-analyzer")({ enabled: true })
  return analyzer(config)
}

// Sentry build-time wrapper. Source-map upload is gated on
// `SENTRY_AUTH_TOKEN` being present so local dev / unconfigured CI doesn't
// break — set the token in production CI to upload symbols. Tunnel route
// works around ad-blockers eating Sentry beacons.
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Skip the upload entirely when no auth token is configured. This makes
  // `npm run build` a no-op for Sentry without yelling at developers who
  // don't have credentials.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Hide source maps from generated client bundles — public source maps
  // expose internal code to anyone who opens devtools.
  hideSourceMaps: true,
  // Disable Sentry's webpack plugin telemetry.
  telemetry: false,
  // Tree-shake the SDK's internal debug-logging statements out of the
  // bundle. The flat `disableLogger: true` form is deprecated in
  // @sentry/nextjs v10 (the build emits the warning naming the exact
  // replacement key path). Has no effect under Turbopack — that's
  // explicit in SentryBuildWebpackOptions.
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
}

export default withSentryConfig(withBundleAnalyzer(withNextIntl(nextConfig)), sentryBuildOptions)
