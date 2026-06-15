/**
 * Permission Management Modal
 * Full-screen sheet for hierarchical ABP permission management.
 * Features: search, group tabs, grant/revoke all, hierarchy-aware toggling,
 * dirty tracking, coverage stats, keyboard shortcuts.
 */

"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Shield, Save, X, Search, RotateCcw, AlertCircle, CheckCheck, XCircle } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/ui/design-system/primitives/sheet"
import { Button } from "@/ui/design-system/primitives/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/design-system/primitives/tabs"
import { Input } from "@/ui/design-system/primitives/input"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Spinner } from "@/ui/design-system/primitives/Spinner"
import { useNotification } from "@/ui/application/hooks/useNotification"
import { useT, useLocale } from "@/shared/config"
import { cn } from "@/shared/utils"
import { securityService } from "@/domains/system/security.service"
import { PermissionList } from "./PermissionList"
import type { PermissionGroupDto, GetPermissionsResponse, UpdatePermissionDto } from "@/shared/types/security.types"

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface PermissionModalProps {
  providerName: string
  providerKey: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line max-lines-per-function, complexity -- Complex modal for hierarchical permission management
export function PermissionModal(props: PermissionModalProps) {
  const { providerName, providerKey, open, onOpenChange, onSuccess } = props
  const t = useT()
  const { direction } = useLocale()
  const notify = useNotification()

  /* ---- State ---- */
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<GetPermissionsResponse | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<string>("")

  const searchInputRef = useRef<HTMLInputElement>(null)

  /* ---- Fetch ---- */
  useEffect(() => {
    if (!open || !providerName || !providerKey) return

    let cancelled = false
    const fetchPermissions = async () => {
      try {
        setLoading(true)
        const result = await securityService.getPermissions(providerName, providerKey)
        if (cancelled) return
        setData(result)

        const initial: Record<string, boolean> = {}
        for (const group of result.groups) {
          for (const perm of group.permissions) {
            initial[perm.name] = perm.isGranted
          }
        }
        setPermissions(initial)
        if (result.groups[0]) setActiveTab(result.groups[0].name)
      } catch (error) {
        if (cancelled) return
        notify.error(error)
        onOpenChange(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPermissions()
    return () => {
      cancelled = true
    }
  }, [open, providerName, providerKey, notify, onOpenChange])

  /* ---- Derived ---- */
  const allPermissions = useMemo(() => data?.groups.flatMap(g => g.permissions) ?? [], [data])

  const isDirty = useMemo(() => {
    if (!data) return false
    return allPermissions.some(p => permissions[p.name] !== p.isGranted)
  }, [allPermissions, permissions, data])

  const permissionHierarchy = useMemo(() => {
    const h: Record<string, { parent?: string; children: string[] }> = {}
    for (const p of allPermissions) {
      if (!h[p.name]) h[p.name] = { children: [] }
      if (p.parentName) {
        h[p.name]!.parent = p.parentName
        if (!h[p.parentName]) h[p.parentName] = { children: [] }
        h[p.parentName]!.children.push(p.name)
      }
    }
    return h
  }, [allPermissions])

  const filteredGroups = useMemo(() => {
    if (!data) return []
    if (!searchQuery.trim()) return data.groups
    const q = searchQuery.toLowerCase()
    return data.groups
      .map(g => ({
        ...g,
        permissions: g.permissions.filter(
          p => p.displayName.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.permissions.length > 0)
  }, [data, searchQuery])

  const stats = useMemo(() => {
    const total = allPermissions.length
    const granted = allPermissions.filter(p => permissions[p.name]).length
    return { total, granted, percent: total > 0 ? Math.round((granted / total) * 100) : 0 }
  }, [allPermissions, permissions])

  /* ---- Per-group stats ---- */
  const groupStats = useMemo(() => {
    const map: Record<string, { granted: number; total: number }> = {}
    for (const g of data?.groups ?? []) {
      const total = g.permissions.length
      const granted = g.permissions.filter(p => permissions[p.name]).length
      map[g.name] = { granted, total }
    }
    return map
  }, [data, permissions])

  /* ---- Handlers ---- */
  const handleReset = useCallback(() => {
    if (!data) return
    const initial: Record<string, boolean> = {}
    for (const group of data.groups) {
      for (const perm of group.permissions) {
        initial[perm.name] = perm.isGranted
      }
    }
    setPermissions(initial)
  }, [data])

  const handleToggle = useCallback(
    (name: string, checked: boolean) => {
      setPermissions(prev => {
        const updated = { ...prev }
        const walk = (id: string, value: boolean) => {
          updated[id] = value
          if (!value) {
            for (const child of permissionHierarchy[id]?.children ?? []) walk(child, false)
          } else {
            let cur = permissionHierarchy[id]?.parent
            while (cur) {
              updated[cur] = true
              cur = permissionHierarchy[cur]?.parent
            }
          }
        }
        walk(name, checked)
        return updated
      })
    },
    [permissionHierarchy],
  )

  const handleSetAllGroup = useCallback((group: PermissionGroupDto, value: boolean) => {
    setPermissions(prev => {
      const updated = { ...prev }
      for (const p of group.permissions) updated[p.name] = value
      return updated
    })
  }, [])

  const handleGrantAll = useCallback(() => {
    setPermissions(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) next[key] = true
      return next
    })
  }, [])

  const handleRevokeAll = useCallback(() => {
    setPermissions(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) next[key] = false
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    try {
      setSaving(true)
      const input: UpdatePermissionDto[] = Object.entries(permissions).map(([name, isGranted]) => ({ name, isGranted }))
      await securityService.updatePermissions(providerName, providerKey, { permissions: input })
      notify.success("common.messages.successUpdate")
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      notify.error(error)
    } finally {
      setSaving(false)
    }
  }, [permissions, providerName, providerKey, notify, onSuccess, onOpenChange])

  /* ---- Keyboard shortcuts: Ctrl+S save, Ctrl+F search ---- */
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (isDirty && !saving) handleSave()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, isDirty, saving, handleSave])

  if (!open) return null

  /* ---- Render ---- */
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="full" className="p-0 flex flex-col h-full border-none shadow-none bg-background">
        {/* Header */}
        <SheetHeader className="flex-none border-b bg-card px-6 py-4">
          <div className="flex flex-col gap-3 w-full">
            {/* Title row */}
            <div className="flex items-center justify-between gap-4">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold tracking-tight">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span>
                    {providerName === "R"
                      ? t("pages.role_permissions") || "Role Permissions"
                      : providerName === "U"
                        ? t("pages.user_permissions") || "User Permissions"
                        : t("pages.permissions") || "Permissions"}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {data?.entityDisplayName || providerKey}
                  </span>
                </div>
              </SheetTitle>

              <div className="flex items-center gap-2">
                {isDirty && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-warning"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("common.reset") || "Reset"}
                  </Button>
                )}
              </div>
            </div>

            <SheetDescription className="sr-only">
              {t("pages.permissions_description") || "Manage access levels and functional permissions."}
            </SheetDescription>

            {/* Stats + Actions + Search + Save row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Coverage pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-xs font-medium">
                <span className="text-muted-foreground">{t("common.granted") || "Granted"}:</span>
                <span className="font-bold text-primary tabular-nums">{stats.granted}</span>
                <span className="text-muted-foreground/60">/ {stats.total}</span>
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden ms-1">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${stats.percent}%` }}
                  />
                </div>
                <span className="font-bold text-primary tabular-nums text-[11px]">{stats.percent}%</span>
              </div>

              {/* Global grant/revoke */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGrantAll}
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1 rounded-md"
                >
                  <CheckCheck className="h-3 w-3" />
                  {t("common.grantAll") || "Grant All"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeAll}
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1 rounded-md text-muted-foreground hover:text-destructive hover:border-destructive/30"
                >
                  <XCircle className="h-3 w-3" />
                  {t("common.revokeAll") || "Revoke All"}
                </Button>
              </div>

              {/* Search */}
              <div className="flex-1 min-w-50 max-w-sm ms-auto relative">
                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  ref={searchInputRef}
                  placeholder={`${t("common.search") || "Search"}... (Ctrl+F)`}
                  className="ps-8 h-8 text-xs rounded-lg bg-muted/30 border-border/50 focus:border-primary/50"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute end-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Save / Cancel — in header */}
              <div className="flex items-center gap-2 border-s border-border/50 ps-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-8 px-3 text-xs font-medium text-muted-foreground"
                >
                  {t("common.cancel") || "Cancel"}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || loading || !isDirty}
                  size="sm"
                  className={cn(
                    "h-8 px-4 text-xs font-semibold gap-1.5 transition-all",
                    isDirty && !saving ? "shadow-md shadow-primary/20" : "",
                  )}
                >
                  {saving ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  {t("common.save") || "Save"}
                </Button>
              </div>
            </div>

            {/* Dirty indicator */}
            {isDirty && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs font-medium text-warning">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{t("common.unsaved_changes") || "You have unsaved changes"}</span>
                <span className="text-muted-foreground ms-1">
                  — {t("common.save_to_apply") || "Press Ctrl+S or click Save to apply"}
                </span>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Body: Sidebar + Content */}
        <div className="flex-1 flex overflow-hidden">
          {loading || !data ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Spinner size={32} className="text-primary/60" />
                <span className="text-sm text-muted-foreground">{t("common.loading") || "Loading permissions..."}</span>
              </div>
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              dir={direction as "ltr" | "rtl"}
              className="flex-1 flex flex-row overflow-hidden"
            >
              {/* Sidebar */}
              <div className="w-72 xl:w-80 shrink-0 flex flex-col border-e bg-muted/20 overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                    {t("common.groups") || "Permission Groups"}
                  </span>
                </div>
                <TabsList className="flex flex-col h-auto w-full bg-transparent p-2 gap-0.5 overflow-y-auto flex-1 custom-scrollbar">
                  {filteredGroups.map(group => {
                    const gs = groupStats[group.name]
                    const isAllGranted = gs && gs.granted === gs.total
                    return (
                      <TabsTrigger
                        key={group.name}
                        value={group.name}
                        className={cn(
                          "w-full justify-start px-3 py-2.5 h-auto rounded-lg text-start transition-all",
                          "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm",
                        )}
                      >
                        <div className="flex items-center gap-2.5 w-full min-w-0">
                          <div
                            className={cn(
                              "shrink-0 w-2 h-2 rounded-full transition-colors",
                              isAllGranted
                                ? "bg-primary"
                                : gs && gs.granted > 0
                                  ? "bg-warning"
                                  : "bg-muted-foreground/20",
                            )}
                          />
                          <span className="text-xs font-semibold truncate flex-1">{group.displayName}</span>
                          <Badge variant="secondary" className="shrink-0 text-[10px] h-5 px-1.5 rounded-md font-mono">
                            {gs ? `${gs.granted}/${gs.total}` : group.permissions.length}
                          </Badge>
                        </div>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              {/* Content area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {filteredGroups.map(group => (
                  <TabsContent
                    key={group.name}
                    value={group.name}
                    className="flex-1 m-0 p-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
                  >
                    <PermissionList
                      group={group}
                      permissions={permissions}
                      onSetAll={handleSetAllGroup}
                      onToggle={handleToggle}
                    />
                  </TabsContent>
                ))}
                {filteredGroups.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <Search className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground">No permissions match &quot;{searchQuery}&quot;</p>
                      <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")} className="text-xs">
                        {t("common.actions.clear_search")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
