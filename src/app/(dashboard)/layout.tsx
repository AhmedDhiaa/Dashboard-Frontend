"use client"

import { DashboardLayout } from "@/ui/layout"
import { EnumProvider } from "@/core/enums"
import { TranslationVersionWatcher } from "./_components/TranslationVersionWatcher"
import { ThemeVersionWatcher } from "./_components/ThemeVersionWatcher"
import {
  TranslationEditorProvider,
  EditOverlay,
  EditPanel,
  PendingChangesTray,
} from "@/features/admin-tools/translation-editor"
import { RuntimeProvider } from "@/features/runtime-builder"
import dynamic from "next/dynamic"

/**
 * CommandPalette uses cmdk (~30 KB gz). Lazy-loaded so it doesn't block
 * the initial dashboard paint, AND mounted at the dashboard layout — not
 * in `ClientProviders` — by deliberate scope:
 *
 *   - Every command targets an authenticated app route (`NAV_GROUPS` from
 *     the dashboard nav). Outside the dashboard layout, those routes
 *     either don't apply (login/session-expired/403) or aren't useful
 *     (error pages — the user is recovering, not navigating).
 *
 *   - Cmd-K on /auth/login would render an empty palette (the
 *     permission-context filter strips every entry for an unauthenticated
 *     user) — visible-but-empty UI is confusing, not helpful.
 *
 *   - Bundle-size: mounting in ClientProviders would ship the cmdk chunk
 *     to /auth/login, /403, and the error pages, where 99% of visits
 *     never use it.
 *
 * If "Cmd-K everywhere" becomes a real requirement (e.g. a documentation
 * search that works pre-login), build that as a separate, lighter
 * component — don't widen this one.
 */
const CommandPalette = dynamic(() => import("@/features/navigation/CommandPalette").then(m => m.CommandPalette), {
  ssr: false,
})

export default function Layout({ children }: { children: React.ReactNode }) {
  // Authentication is handled by middleware - no need for client-side check
  return (
    <EnumProvider preloadEnums={["status"]}>
      <TranslationEditorProvider>
        <RuntimeProvider>
          <TranslationVersionWatcher />
          <ThemeVersionWatcher />
          <CommandPalette />
          <DashboardLayout>{children}</DashboardLayout>
          <EditOverlay />
          <EditPanel />
          <PendingChangesTray />
        </RuntimeProvider>
      </TranslationEditorProvider>
    </EnumProvider>
  )
}
