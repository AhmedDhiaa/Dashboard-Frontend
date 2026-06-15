"use client"

import React, { memo } from "react"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { Switch } from "@/ui/design-system/primitives/switch"
import { Badge } from "@/ui/design-system/primitives/badge"
import { useT } from "@/shared/config"
import { cn } from "@/shared/utils"
import { Globe, Mail, Hash, Type, Link2, RotateCcw } from "lucide-react"

export interface ApiSettingFieldProps {
  name: string
  value: string
  displayName: string
  settingType: "boolean" | "number" | "url" | "email" | "text"
  isDirty: boolean
  originalValue: string
  onUpdate: (name: string, value: string) => void
  onReset: (name: string) => void
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  boolean: Globe,
  number: Hash,
  url: Link2,
  email: Mail,
  text: Type,
}

/* Boolean toggle row */
const BooleanSettingField = memo(function BooleanSettingField({
  name,
  value,
  displayName,
  isDirty,
  originalValue,
  onUpdate,
  onReset,
}: Omit<ApiSettingFieldProps, "settingType">) {
  const t = useT("pages")
  const Icon = TYPE_ICONS.boolean ?? Globe
  const boolVal = value.toLowerCase() === "true"

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-xl border transition-colors",
        isDirty ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:border-border/70",
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{displayName}</span>
          <span className="text-[9px] font-mono text-muted-foreground/60 truncate">{name}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isDirty && (
          <button
            type="button"
            onClick={() => onReset(name)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={t("api_settings.reset_to", { value: originalValue })}
            title={t("api_settings.reset_to", { value: originalValue })}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] font-medium px-1.5 h-5 rounded",
            boolVal
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-muted text-muted-foreground border-border/30",
          )}
        >
          {boolVal ? t("common.enabled") : t("common.disabled")}
        </Badge>
        <Switch checked={boolVal} onCheckedChange={checked => onUpdate(name, checked ? "True" : "False")} />
      </div>
    </div>
  )
})

/* Text/number/url/email input row */
const TextSettingField = memo(function TextSettingField({
  name,
  value,
  displayName,
  settingType,
  isDirty,
  originalValue,
  onUpdate,
  onReset,
}: ApiSettingFieldProps) {
  const t = useT("pages")
  const Icon = TYPE_ICONS[settingType] || Type
  const inputType =
    settingType === "number" ? "number" : settingType === "url" ? "url" : settingType === "email" ? "email" : "text"

  return (
    <div
      className={cn(
        "space-y-2 px-4 py-3 rounded-xl border transition-colors",
        isDirty ? "bg-primary/5 border-primary/20" : "bg-card border-border hover:border-border/70",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <Label htmlFor={name} className="text-sm font-medium truncate cursor-pointer">
              {displayName}
            </Label>
            <span className="text-[9px] font-mono text-muted-foreground/60 truncate">{name}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isDirty && (
            <button
              type="button"
              onClick={() => onReset(name)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={t("api_settings.reset_to", { value: originalValue })}
              title={t("api_settings.reset_to", { value: originalValue })}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {value === "" && (
            <Badge variant="outline" className="text-[9px] px-1.5 h-4 rounded">
              {t("api_settings.empty")}
            </Badge>
          )}
        </div>
      </div>
      <Input
        id={name}
        type={inputType}
        value={value}
        onChange={e => onUpdate(name, e.target.value)}
        className="h-9 text-sm"
        placeholder={t("api_settings.enter_placeholder", { label: displayName.toLowerCase() })}
      />
    </div>
  )
})

/* Main dispatcher */
export const ApiSettingField = memo(function ApiSettingField(props: ApiSettingFieldProps) {
  if (props.settingType === "boolean") {
    return <BooleanSettingField {...props} />
  }
  return <TextSettingField {...props} />
})
