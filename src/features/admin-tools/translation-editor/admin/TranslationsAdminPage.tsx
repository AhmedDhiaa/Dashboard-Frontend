"use client"

/**
 * /admin/translations — the override-management surface.
 *
 * Permission gate runs client-side via the existing PermissionContext
 * because PagePermissionGuard is entity-config-based and there's no entity
 * for translation management. Non-admins without `Api.Translation.Manage`
 * get a 403 message in-place.
 */

import { useCallback, useEffect, useState } from "react"
import { Languages, ShieldAlert } from "lucide-react"
import { Input } from "@/ui/design-system/primitives/input"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { fetchOverrides } from "../api"
import { AddKeyForm } from "./AddKeyForm"
import { ExportButton } from "./ExportButton"
import { ImportDialog } from "./ImportDialog"
import { OverridesTable } from "./OverridesTable"
import { SourceBrowser } from "./SourceBrowser"
import { WriteModeBadge } from "../components/WriteModeBadge"
import { SOURCE_WRITE_ENABLED } from "../lib/write-mode"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

const MANAGE_PERMISSION = PERMISSIONS.TRANSLATION_MANAGE
const LOCALES = ["en", "ar"] as const
type Locale = (typeof LOCALES)[number]

type ViewMode = "overrides" | "all"

/**
 * On-disk namespace files (messages/<locale>/<file>.json). The `enum` file is
 * exposed to consumers as namespace "Enum", but source read/write uses the
 * on-disk name "enum" — so we keep the API value separate from the label.
 */
const NAMESPACES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "common", label: "common" },
  { value: "auth", label: "auth" },
  { value: "errors", label: "errors" },
  { value: "nav", label: "nav" },
  { value: "crud", label: "crud" },
  { value: "forms", label: "forms" },
  { value: "table", label: "table" },
  { value: "map", label: "map" },
  { value: "dashboard", label: "dashboard" },
  { value: "settings", label: "settings" },
  { value: "pages", label: "pages" },
  { value: "pages_dynamic", label: "pages_dynamic" },
  { value: "pages_tickets", label: "pages_tickets" },
  { value: "pages_tracking", label: "pages_tracking" },
  { value: "theme", label: "theme" },
  { value: "admin", label: "admin" },
  { value: "showcase", label: "showcase" },
  { value: "enum", label: "Enum" },
]

export function TranslationsAdminPage(): React.ReactNode {
  const { isAdmin, isGranted, isLoading } = usePermissionContext()
  const [locale, setLocale] = useState<Locale>("en")
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>("overrides")
  const [namespace, setNamespace] = useState<string>(NAMESPACES[0]!.value)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setOverrides(await fetchOverrides(locale))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overrides")
    } finally {
      setLoading(false)
    }
  }, [locale])

  useEffect(() => {
    void reload()
  }, [reload])

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading permissions…</div>
  }

  if (!isAdmin && !isGranted(MANAGE_PERMISSION)) {
    return (
      <div className="p-12 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <p className="font-semibold">You don&apos;t have permission to manage translations.</p>
        <p className="text-xs text-muted-foreground mt-1">Required: {MANAGE_PERMISSION}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
            <Languages className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold">
                {view === "all" ? "All translations" : "Translation overrides"}
              </h1>
              <WriteModeBadge />
            </div>
            <Subtitle view={view} locale={locale} namespace={namespace} overrideCount={Object.keys(overrides).length} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewSwitch view={view} onView={setView} />
          {view === "all" && <NamespaceSelect namespace={namespace} onNamespace={setNamespace} />}
          <LocaleSwitch locale={locale} onLocale={setLocale} />
          <AddKeyForm onAdded={() => void reload()} />
          <ExportButton locale={locale} overrides={overrides} disabled={loading} />
          <ImportDialog locale={locale} currentOverrides={overrides} onImported={() => void reload()} />
        </div>
      </header>

      {!SOURCE_WRITE_ENABLED && (
        <p className="text-xs text-muted-foreground">
          Browsing base translations requires source-write mode (NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN=true).
        </p>
      )}

      <Input placeholder="Search keys or values…" value={search} onChange={e => setSearch(e.target.value)} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border border-border rounded-md overflow-hidden">
        {view === "all" ? (
          <SourceBrowser locale={locale} namespace={namespace} search={search} />
        ) : loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <OverridesTable locale={locale} overrides={overrides} onChanged={() => void reload()} search={search} />
        )}
      </div>
    </div>
  )
}

function Subtitle({
  view,
  locale,
  namespace,
  overrideCount,
}: {
  view: ViewMode
  locale: Locale
  namespace: string
  overrideCount: number
}) {
  return (
    <p className="text-xs text-muted-foreground">
      {view === "all" ? (
        <>
          Browsing namespace <span className="font-mono">{namespace}</span> for<span className="font-mono"> {locale}</span>
        </>
      ) : (
        <>
          {overrideCount} override{overrideCount === 1 ? "" : "s"} for<span className="font-mono"> {locale}</span>
        </>
      )}
    </p>
  )
}

function ViewSwitch({ view, onView }: { view: ViewMode; onView: (v: ViewMode) => void }) {
  return (
    <div
      className="inline-flex rounded-md border border-border overflow-hidden"
      title={SOURCE_WRITE_ENABLED ? undefined : "Browsing base translations requires source-write mode."}
    >
      <button
        onClick={() => onView("overrides")}
        className={`px-3 py-1.5 text-xs font-medium ${
          view === "overrides" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
        }`}
      >
        Overrides
      </button>
      <button
        onClick={() => SOURCE_WRITE_ENABLED && onView("all")}
        disabled={!SOURCE_WRITE_ENABLED}
        className={`px-3 py-1.5 text-xs font-medium ${
          view === "all" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
        } ${SOURCE_WRITE_ENABLED ? "" : "opacity-50 cursor-not-allowed"}`}
      >
        All translations
      </button>
    </div>
  )
}

function NamespaceSelect({ namespace, onNamespace }: { namespace: string; onNamespace: (v: string) => void }) {
  return (
    <select
      value={namespace}
      onChange={e => onNamespace(e.target.value)}
      className="h-9 rounded-md border border-border bg-card px-2 text-xs font-medium"
      aria-label="Namespace"
    >
      {NAMESPACES.map(ns => (
        <option key={ns.value} value={ns.value}>
          {ns.label}
        </option>
      ))}
    </select>
  )
}

function LocaleSwitch({ locale, onLocale }: { locale: Locale; onLocale: (l: Locale) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden">
      {LOCALES.map(l => (
        <button
          key={l}
          onClick={() => onLocale(l)}
          className={`px-3 py-1.5 text-xs font-medium ${
            l === locale ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
