"use client"

import { Settings, Save, RefreshCw, X } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { useT } from "@/shared/config"
import { cn } from "@/shared/utils"

export function SettingsHeader({
  totalSettings,
  totalGroups,
  totalDirty,
  saving,
  onResetAll,
  onRefresh,
  onSave,
}: {
  totalSettings: number
  totalGroups: number
  totalDirty: number
  saving: boolean
  onResetAll: () => void
  onRefresh: () => void
  onSave: () => void
}) {
  const t = useT("pages")
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b border-border">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">{t("api_settings_label")}</h2>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {t("api_settings.settings_summary", { count: totalSettings, groups: totalGroups })}
            {totalDirty > 0 && (
              <span className="text-primary font-medium ms-1">
                {t("api_settings.unsaved_count", { count: totalDirty })}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {totalDirty > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            className="h-8 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3 me-1" />
            {t("common.discard")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={saving} className="h-8 text-xs">
          <RefreshCw className={cn("h-3 w-3 me-1", saving && "animate-spin")} />
          {t("common.refresh")}
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || totalDirty === 0} className="h-8 text-xs min-w-20">
          {saving ? <RefreshCw className="h-3 w-3 me-1 animate-spin" /> : <Save className="h-3 w-3 me-1" />}
          {t("common.save")} {totalDirty > 0 ? `(${totalDirty})` : ""}
        </Button>
      </div>
    </div>
  )
}
