"use client"

import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { useT } from "@/shared/config"

export function DirtyFooter({
  totalDirty,
  saving,
  onResetAll,
  onSave,
}: {
  totalDirty: number
  saving: boolean
  onResetAll: () => void
  onSave: () => void
}) {
  const t = useT("pages")
  if (totalDirty === 0) return null
  return (
    <div className="flex items-center justify-between px-5 py-2.5 bg-primary/5 border-t border-primary/20">
      <div className="flex items-center gap-2 text-xs text-primary">
        <AlertCircle className="h-3.5 w-3.5" />
        <span className="font-medium tabular-nums">
          {totalDirty} unsaved change{totalDirty !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetAll}
          className="h-7 text-[10px] text-muted-foreground hover:text-destructive"
        >
          {t("api_settings.discard_all")}
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="h-7 text-[10px]">
          <CheckCircle2 className="h-3 w-3 me-1" />
          {t("api_settings.save_changes")}
        </Button>
      </div>
    </div>
  )
}
