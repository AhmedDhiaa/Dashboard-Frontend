import type React from "react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { APP_NAME } from "@/shared/config/brand"
import { ClientProviders } from "./ClientProviders"
import { WebVitalsReporter } from "./WebVitalsReporter"

/**
 * Brand-driven document metadata. `title.default` gives every route a non-empty
 * `<title>` (fixes the axe `document-title` rule app-wide); `title.template`
 * lets a page prefix its own name. White-label: reads the configured brand, so
 * it stays generic for any deployment.
 */
export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_NAME} — administration dashboard`,
}
import { getLocale, getMessages, getTranslations } from "next-intl/server"
import { themeInitScript } from "@/ui/theme/init"
import { readStore as readThemeStore } from "@/app/api/theme/_lib/storage"
import { buildThemeCss } from "@/app/api/theme/_lib/build-css"
import { hydrateEntityOverrides } from "@/features/admin-tools/entity-overrides/hydrate"
import { readEntityOverrides } from "@/features/admin-tools/entity-overrides/storage"
import "./globals.css"
import { cn } from "@/shared/utils"

type Props = {
  children: React.ReactNode
}

import { fontSans, fontMono, fontArabic } from "@/ui/theme/font-loader"

export default async function RootLayout({ children }: Props) {
  // All per-request inputs are independent, so resolve them concurrently
  // instead of serially — on a cold cache this collapses 5+ round-trips of
  // i18n resolution + file I/O (theme store, entity overrides) into one.
  //
  // - locale/messages/tCommon: next-intl server APIs (React-cached per request).
  // - headers(): per-request CSP nonce. Middleware mints it in production and
  //   forwards it via `x-nonce`; in dev the header is absent and the existing
  //   `'unsafe-inline'` CSP renders inline scripts unmodified (`nonce={undefined}`
  //   is a noop on <script>).
  // - readThemeStore(): live theme tokens, server-rendered so first paint uses
  //   the override-applied palette (no FOUC). The dashboard watcher bumps on
  //   publish and router.refresh() re-runs this layout to re-emit the <style>.
  // - hydrateEntityOverrides()→readEntityOverrides(): apply entity-config admin
  //   overrides server-side so SSR matches client hydration; the second read is
  //   a cache hit from the hydrate.
  const [locale, messages, tCommon, headerStore, themeStore, entityOverrides] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations("common"),
    headers(),
    readThemeStore(),
    hydrateEntityOverrides().then(readEntityOverrides),
  ])

  const dir = locale === "ar" ? "rtl" : "ltr"
  const nonce = headerStore.get("x-nonce") ?? undefined
  const themeCss = buildThemeCss(themeStore.live.tokens)

  return (
    <html
      lang={locale}
      dir={dir}
      className={cn(fontSans.variable, fontMono.variable, fontArabic.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* SELF-HOSTED font menu for the Theme Studio picker (no CDN). The
            families live under /public/fonts and are referenced by the
            --font-sans / --font-arabic theme tokens when an admin picks one in
            /admin/theme. Loaded as runtime stylesheets (not next/font) on
            purpose: next/font bakes a fixed family, which defeats runtime
            switching. `web-fonts.css` = curated Google families self-hosted as
            woff2 (scripts/fetch-local-fonts.sh); `brand-fonts.css` = the 29LT
            PBL brand fonts. Same-origin, so the strict CSP `'self'` allows
            both with no extra directives. */}
        {/* eslint-disable-next-line @next/next/no-css-tags -- self-hosted runtime font menu for the Theme Studio (see note) */}
        <link rel="stylesheet" href="/fonts/web-fonts.css" />
        {/* eslint-disable-next-line @next/next/no-css-tags -- self-hosted 29LT brand fonts (see note) */}
        <link rel="stylesheet" href="/fonts/brand-fonts.css" />
        {themeCss && <style id="theme-overrides" nonce={nonce} dangerouslySetInnerHTML={{ __html: themeCss }} />}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <WebVitalsReporter />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
        >
          {tCommon("a11y.skip_to_main")}
        </a>
        <ClientProviders locale={locale as "en" | "ar"} messages={messages} entityOverrides={entityOverrides}>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
