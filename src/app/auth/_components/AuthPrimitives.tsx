/**
 * Shared Auth Page Primitives
 *
 * Extracted from login/page.tsx so all auth pages (login, register,
 * forgot-password) share the same visual language without violating
 * Next.js's page export constraints.
 *
 * The auth screens use a modern split layout: a branded panel (desktop) beside
 * a clean form column. These primitives provide the panel, the compact mobile
 * brand header, and the form card.
 */

import { Check } from "lucide-react"
import { cn } from "@/shared/utils"
import { APP_NAME } from "@/shared/config/brand"
import { BrandGlyph } from "@/ui/brand/Logo"

/**
 * Ambient background blobs for the form side — CSS-only, zero JS cost. Subtle
 * so the form stays the focus.
 */
export function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden">
      <div className="absolute start-[-10%] top-[-15%] h-[45%] w-[45%] animate-[pulse_12s_ease-in-out_infinite] rounded-full bg-primary/10 blur-[130px]" />
      <div className="absolute bottom-[-15%] end-[-10%] h-[45%] w-[45%] animate-[pulse_16s_ease-in-out_infinite_2s] rounded-full bg-accent/10 blur-[130px]" />
    </div>
  )
}

/** A tokenized brand monogram tile. */
function Monogram({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg ring-1 ring-inset ring-white/15",
        className,
      )}
    >
      <BrandGlyph className="size-[55%]" />
    </div>
  )
}

/**
 * The branded hero panel shown beside the form on large screens. A premium
 * gradient surface with an ambient glow + dotted grid, a wordmark, a large
 * brand hero, and a footer line.
 */
export function AuthBrandPanel({ t }: { t: (key: string) => string }) {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-accent p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
      {/* Ambient glow + dotted grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute end-[-10%] top-[-10%] h-[55%] w-[55%] rounded-full bg-white/15 blur-[120px]" />
        <div className="absolute bottom-[-15%] start-[-10%] h-[55%] w-[55%] rounded-full bg-accent/30 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      {/* Wordmark */}
      <div className="relative z-10 flex items-center gap-3">
        <Monogram className="h-11 w-11 text-lg" />
        <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
      </div>

      {/* Hero */}
      <div className="relative z-10 max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-700">
        <div className="space-y-4">
          <h2 className="text-4xl font-bold leading-[1.15] tracking-tight xl:text-5xl">{APP_NAME}</h2>
          <p className="text-lg leading-relaxed text-primary-foreground/85">{t("tagline")}</p>
          <div className="h-1 w-16 rounded-full bg-primary-foreground/40" />
        </div>
        <ul className="space-y-3">
          {(["crud", "i18n", "theme"] as const).map(key => (
            <li key={key} className="flex items-center gap-3 text-sm font-medium text-primary-foreground/90">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Check className="size-3" />
              </span>
              {t(`features.${key}`)}
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-xs font-medium text-primary-foreground/60">
        {APP_NAME} · {t("tagline")}
      </div>
    </div>
  )
}

/**
 * Compact brand header for the form column (shown on mobile where the brand
 * panel is hidden, and optionally above the card).
 */
export function AuthBrandHeader({ t, className }: { t: (key: string) => string; className?: string }) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col items-center gap-4 text-center duration-500 animate-in fade-in slide-in-from-bottom-2",
        className,
      )}
    >
      <Monogram className="h-16 w-16 text-2xl" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground">{t("tagline")}</p>
      </div>
    </div>
  )
}

/**
 * Form card wrapper with a thin top accent stripe.
 */
export function AuthCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl",
        "duration-300 animate-in fade-in",
        className,
      )}
    >
      <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary opacity-80" />
      {children}
    </div>
  )
}
