"use client"

import { Search } from "lucide-react"
import { ApiSettingField } from "../ApiSettingItem"
import { ApiSettingJsonField } from "../ApiSettingJsonItem"
import { useT } from "@/shared/config"
import { cleanSettingDisplayName, detectSettingType, type GroupedSettings } from "../_utils"

export function GroupContent({
  grouped,
  settings,
  originalSettings,
  searchQuery,
  onUpdate,
  onReset,
}: {
  grouped: GroupedSettings
  settings: Record<string, string>
  originalSettings: Record<string, string>
  searchQuery: string
  onUpdate: (name: string, value: string) => void
  onReset: (name: string) => void
}) {
  const t = useT("pages")
  const Icon = grouped.group.icon
  const q = searchQuery.toLowerCase()
  const filteredItems = q
    ? grouped.items.filter(s => s.name.toLowerCase().includes(q) || s.value.toLowerCase().includes(q))
    : grouped.items

  if (filteredItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Search className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">{t("api_settings.no_settings_match")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{grouped.group.label}</h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {filteredItems.length} setting{filteredItems.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {filteredItems.map(item => {
          const cur = settings[item.name] ?? item.value
          const orig = originalSettings[item.name] ?? item.value
          const dirty = cur !== orig
          const sType = detectSettingType(item.name, cur)
          const display = cleanSettingDisplayName(item.name, grouped.group.prefixes)

          if (sType === "json") {
            return (
              <ApiSettingJsonField
                key={item.name}
                name={item.name}
                value={cur}
                displayName={display}
                isDirty={dirty}
                originalValue={orig}
                onUpdate={onUpdate}
                onReset={onReset}
              />
            )
          }
          return (
            <ApiSettingField
              key={item.name}
              name={item.name}
              value={cur}
              displayName={display}
              settingType={sType}
              isDirty={dirty}
              originalValue={orig}
              onUpdate={onUpdate}
              onReset={onReset}
            />
          )
        })}
      </div>
    </div>
  )
}
