"use client"

import React, { useState, useEffect, useMemo, memo } from "react"
import { Braces, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react"
import { Label } from "@/ui/design-system/primitives/label"
import { Badge } from "@/ui/design-system/primitives/badge"
import { useT } from "@/shared/config"
import { cn } from "@/shared/utils"

interface ApiSettingJsonItemProps {
  name: string
  value: string
  displayName: string
  isDirty: boolean
  originalValue: string
  onUpdate: (name: string, value: string) => void
  onReset: (name: string) => void
}

export const ApiSettingJsonField = memo(function ApiSettingJsonField({
  name,
  value,
  displayName,
  isDirty,
  originalValue: _originalValue,
  onUpdate,
  onReset,
}: ApiSettingJsonItemProps) {
  const t = useT("pages")
  const [jsonStr, setJsonStr] = useState(value)

  useEffect(() => {
    setJsonStr(value)
  }, [value])

  const { parsed, isValid } = useMemo(() => {
    try {
      const p = JSON.parse(jsonStr)
      return { parsed: p as Record<string, unknown>, isValid: true }
    } catch {
      return { parsed: null, isValid: false }
    }
  }, [jsonStr])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    setJsonStr(newVal)
    try {
      JSON.parse(newVal)
      onUpdate(name, newVal)
    } catch {
      // Wait for valid JSON
    }
  }

  return (
    <div
      className={cn(
        "space-y-3 p-4 rounded-xl border transition-colors",
        isDirty ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:border-border/70",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Braces className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <Label className="text-sm font-medium truncate">{displayName}</Label>
            <span className="text-[9px] font-mono text-muted-foreground truncate">{name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <button
              type="button"
              onClick={() => onReset(name)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={t("api_settings.reset_btn")}
              title={t("api_settings.reset_btn")}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          <Badge variant={isValid ? "outline" : "destructive"} className="text-[9px] h-5">
            {isValid ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {t("api_settings.valid_json")}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {t("api_settings.invalid_json")}
              </span>
            )}
          </Badge>
        </div>
      </div>

      <textarea
        value={jsonStr}
        onChange={handleChange}
        className={cn(
          "w-full min-h-25 p-3 text-xs font-mono rounded-lg border bg-background outline-none transition-colors resize-y focus:ring-2 focus:ring-offset-0",
          !isValid ? "border-destructive focus:ring-destructive/40" : "border-border focus:ring-ring/40",
        )}
        placeholder='{ "key": "value" }'
      />

      {isValid && parsed && (
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(parsed).map(([k, v]) => (
            <div key={k} className="flex flex-col p-2 bg-muted/40 rounded-lg border border-border text-[10px]">
              <span className="text-muted-foreground font-mono truncate">{k}</span>
              <span className="font-semibold truncate text-foreground">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
