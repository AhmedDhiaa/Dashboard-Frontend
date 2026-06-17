"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { LayoutDashboard, Settings, LogOut, Plus, Clock, Loader2 } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/ui/design-system/primitives/command"
import { NAV_GROUPS } from "@/shared/config/navigation"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { getKnownEntityNames, ensureEntityConfig, getEntityConfig, hasEntityConfig } from "@/core/entities/registry"
import { getRecentRecords, pushRecentRecord, type RecentRecord } from "@/shared/utils/recent-records"
import { useLiveRecordSearch, type LiveSearchResult } from "./useLiveRecordSearch"

interface CreateAction {
  entityName: string
  /** i18n key for the entity's list title. */
  titleKey: string
  route: string
  permissionKey?: string
}

type RunCommand = (command: () => void) => void

/** Build "Create X" actions from the entity registry (the authoritative source
 *  for `features.create`, basePath and the create route). Loads all lazy
 *  configs once; cheap modules, cached after first open. */
async function buildCreateActions(): Promise<CreateAction[]> {
  const names = getKnownEntityNames()
  await Promise.all(names.map(n => ensureEntityConfig(n).catch(() => {})))
  const actions: CreateAction[] = []
  for (const name of names) {
    if (!hasEntityConfig(name)) continue
    const cfg = getEntityConfig(name)
    if (cfg.features?.create === false) continue
    const basePath = cfg.basePath ?? `/${cfg.entityName}`
    actions.push({
      entityName: cfg.entityName,
      titleKey: cfg.translations?.listTitle ?? cfg.entityName,
      // Matches the app's own "Add" button route (resolves via [id]/edit, id="create").
      route: cfg.routes?.create ?? `${basePath}/create/edit`,
      permissionKey: cfg.permissionKey,
    })
  }
  return actions
}

function RecentGroup({ recent, run }: { recent: RecentRecord[]; run: RunCommand }) {
  const t = useTranslations()
  const router = useRouter()
  if (recent.length === 0) return null
  return (
    <>
      <CommandGroup heading={t("nav.recent")}>
        {recent.map(r => (
          <CommandItem
            key={r.href}
            value={`recent ${r.title} ${r.entity ?? ""} ${r.href}`}
            onSelect={() => run(() => router.push(r.href))}
          >
            <Clock className="me-2 h-4 w-4 text-muted-foreground" />
            <span className="truncate">{r.title}</span>
            {r.entity && <span className="ms-2 text-xs text-muted-foreground truncate">{r.entity}</span>}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandSeparator />
    </>
  )
}

function QuickActionsGroup({ actions, run }: { actions: Array<CreateAction & { label: string }>; run: RunCommand }) {
  const t = useTranslations()
  const router = useRouter()
  if (actions.length === 0) return null
  return (
    <>
      <CommandGroup heading={t("nav.quick_actions")}>
        {actions.map(a => (
          <CommandItem key={a.entityName} value={`create new ${a.label}`} onSelect={() => run(() => router.push(a.route))}>
            <Plus className="me-2 h-4 w-4 text-primary" />
            <span>{t("common.create_x", { name: a.label })}</span>
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandSeparator />
    </>
  )
}

function NavigationGroups({ isGranted, run }: { isGranted: (p: string) => boolean; run: RunCommand }) {
  const t = useTranslations()
  const router = useRouter()
  return (
    <>
      {NAV_GROUPS.map(group => {
        const items = group.items.filter(i => !i.requiredPermission || isGranted(i.requiredPermission))
        if (items.length === 0) return null
        return (
          <React.Fragment key={group.titleKey}>
            <CommandGroup heading={t(group.titleKey)}>
              {items.map(item => (
                <CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
                  <group.icon className="me-2 h-4 w-4" />
                  <span>{t(item.titleKey)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </React.Fragment>
        )
      })}
    </>
  )
}

/**
 * Live record search results. Each CommandItem `value` is prefixed with the raw
 * term so cmdk's fuzzy filter always keeps server-matched rows (it would
 * otherwise hide hits whose label doesn't substring-match), while static groups
 * keep filtering normally.
 */
function LiveRecordsGroup({ live, run, term }: { live: LiveSearchResult; run: RunCommand; term: string }) {
  const t = useTranslations()
  const router = useRouter()
  if (!live.hasTerm) return null

  const heading = t("common.command_palette.search_results")
  if (live.loading && live.groups.length === 0) {
    return (
      <CommandGroup heading={heading}>
        <CommandItem value={`${term} __searching`} disabled>
          <Loader2 className="me-2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          <span role="status" aria-live="polite">
            {t("common.command_palette.searching")}
          </span>
        </CommandItem>
      </CommandGroup>
    )
  }
  if (live.error) {
    return (
      <CommandGroup heading={heading}>
        <CommandItem value={`${term} __error`} disabled>
          <span role="status" aria-live="polite">
            {t("common.command_palette.search_error")}
          </span>
        </CommandItem>
      </CommandGroup>
    )
  }
  if (live.groups.length === 0) {
    return (
      <CommandGroup heading={heading}>
        <CommandItem value={`${term} __empty`} disabled>
          <span role="status" aria-live="polite">
            {t("common.command_palette.no_records")}
          </span>
        </CommandItem>
      </CommandGroup>
    )
  }

  return (
    <>
      {live.groups.map(g => {
        const Icon = g.target.icon
        return (
          <CommandGroup key={g.target.entityName} heading={t(g.target.titleKey)}>
            {g.items.map(it => (
              <CommandItem
                key={it.href}
                value={`${term} ${it.label} ${String(it.id)} ${g.target.entityName}`}
                onSelect={() =>
                  run(() => {
                    pushRecentRecord({ href: it.href, title: it.label, entity: t(g.target.titleKey) }, Date.now())
                    router.push(it.href)
                  })
                }
              >
                <Icon className="me-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{it.label}</span>
                <span className="ms-2 text-xs text-muted-foreground truncate">{String(it.id)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )
      })}
      <CommandSeparator />
    </>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState("")
  const [createActions, setCreateActions] = useState<CreateAction[]>([])
  const [recent, setRecent] = useState<RecentRecord[]>([])
  const router = useRouter()
  const t = useTranslations()
  const { isGranted } = usePermissionContext()
  const live = useLiveRecordSearch(term, open)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // On open: refresh recent records (sync) + build create-actions (async).
  // On close: clear the term so a stale query doesn't flash on next open.
  useEffect(() => {
    if (!open) {
      setTerm("")
      return
    }
    setRecent(getRecentRecords())
    let cancelled = false
    void buildCreateActions().then(a => !cancelled && setCreateActions(a))
    return () => {
      cancelled = true
    }
  }, [open])

  const run = useCallback<RunCommand>(command => {
    setOpen(false)
    command()
  }, [])

  // Permission-filtered (admins bypass via isGranted), sorted by translated title.
  const allowedCreate = createActions
    .filter(a => !a.permissionKey || isGranted(`${a.permissionKey}.Create`))
    .map(a => ({ ...a, label: t(a.titleKey) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput value={term} onValueChange={setTerm} placeholder={t("common.placeholders.search")} />
      <CommandList>
        <CommandEmpty>{t("crud.messages.no_results")}</CommandEmpty>

        <LiveRecordsGroup live={live} run={run} term={term} />
        <RecentGroup recent={recent} run={run} />
        <QuickActionsGroup actions={allowedCreate} run={run} />

        <CommandGroup heading={t("nav.overview")}>
          <CommandItem onSelect={() => run(() => router.push("/"))}>
            <LayoutDashboard className="me-2 h-4 w-4" />
            <span>{t("nav.dashboard")}</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />

        <NavigationGroups isGranted={isGranted} run={run} />

        <CommandGroup heading={t("nav.system")}>
          <CommandItem onSelect={() => run(() => router.push("/system/api-settings"))}>
            <Settings className="me-2 h-4 w-4" />
            <span>{t("nav.settings")}</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => {
                // Mirror SidebarChrome: navigate to login first so the screen
                // swaps at once, then clear the session in the background.
                router.push("/auth/login")
                void signOut({ redirect: false })
              })
            }
          >
            <LogOut className="me-2 h-4 w-4" />
            <span>{t("nav.logout") || "Logout"}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
