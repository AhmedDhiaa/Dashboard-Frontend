/**
 * Dev-only design-system gallery — scratch surface for validating UI
 * primitives, form layouts, charts, skeletons, and the full CRUD widget
 * stack in isolation. Strings here are intentionally English-only
 * (a deliberate dev-only exception to the i18n rule); do NOT extract
 * them to the en/ar message catalogs.
 *
 * Folder name note: was previously `__showcase__/`, which Next.js 16
 * treats as a private (non-routable) folder per
 * https://nextjs.org/docs/app/getting-started/project-structure#private-folders
 * — every leading underscore opts the folder + all subroutes OUT of
 * routing, so the showcase pages 404'd. Renamed to `showcase/` so the
 * URLs actually resolve.
 *
 * DELETION TRIGGER:
 *   This folder should be deleted once every primitive/pattern it
 *   showcases has landed in a real product surface AND the user
 *   confirms it's no longer useful for QA / design review. There is
 *   no hard date — this is a manual decision. Until then, treat it as
 *   ephemeral scratch space: pages may be stub, broken, or out of
 *   sync with production; do not polish them.
 */

import { notFound } from "next/navigation"

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound()
  return (
    <div>
      <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 dark:border-warning/30 dark:bg-warning/5 px-4 py-3 flex items-center gap-3">
        <span className="text-xs font-mono font-bold text-warning-foreground bg-warning/20 px-2 py-0.5 rounded">
          DEV ONLY
        </span>
        <p className="text-sm text-foreground/80">
          This showcase is only visible in development mode and is excluded from production builds.
        </p>
      </div>
      {children}
    </div>
  )
}
