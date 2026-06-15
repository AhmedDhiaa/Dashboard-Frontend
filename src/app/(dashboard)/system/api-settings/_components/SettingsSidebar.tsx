"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/ui/design-system/primitives/input"
import { Badge } from "@/ui/design-system/primitives/badge"
import { cn } from "@/shared/utils"
import { useT } from "@/shared/config"
import type { GroupedSettings, SettingGroupDef } from "../_utils"

function SidebarTab({
  group,
  count,
  dirtyCount,
  isActive,
  onClick,
}: {
  group: SettingGroupDef
  count: number
  dirtyCount: number
  isActive: boolean
  onClick: () => void
}) {
  const Icon = group.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-start transition-colors text-sm",
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1">{group.label}</span>
      <div className="flex items-center gap-1 shrink-0">
        {dirtyCount > 0 && (
          <Badge variant="outline" className="text-[8px] h-4 px-1 rounded bg-primary/10 text-primary border-primary/20 tabular-nums">
            {dirtyCount}
          </Badge>
        )}
        <Badge
          variant="outline"
          className="text-[8px] h-4 px-1 rounded bg-muted/50 text-muted-foreground border-border tabular-nums"
        >
          {count}
        </Badge>
      </div>
    </button>
  )
}

export function SettingsSidebar({
  grouped,
  dirtyCountByGroup,
  activeGroup,
  searchQuery,
  onSetActiveGroup,
  onSetSearchQuery,
}: {
  grouped: GroupedSettings[]
  dirtyCountByGroup: Record<string, number>
  activeGroup: string
  searchQuery: string
  onSetActiveGroup: (key: string) => void
  onSetSearchQuery: (q: string) => void
}) {
  const t = useT("pages")
  return (
    <div className="w-56 border-e border-border bg-muted/20 flex flex-col overflow-hidden shrink-0">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => onSetSearchQuery(e.target.value)}
            placeholder={t("api_settings.search_placeholder")}
            className="h-8 ps-8 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSetSearchQuery("")}
              aria-label={t("api_settings.clear_search")}
              title={t("api_settings.clear_search")}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 custom-scrollbar">
        {grouped.map(g => (
          <SidebarTab
            key={g.group.key}
            group={g.group}
            count={g.items.length}
            dirtyCount={dirtyCountByGroup[g.group.key] ?? 0}
            isActive={activeGroup === g.group.key}
            onClick={() => onSetActiveGroup(g.group.key)}
          />
        ))}
      </div>
    </div>
  )
}
