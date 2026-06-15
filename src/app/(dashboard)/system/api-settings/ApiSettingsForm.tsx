"use client"

import { useState, useMemo } from "react"
import { Settings } from "lucide-react"
import { useT } from "@/shared/config"
import { useApiSettings } from "./_hooks/useApiSettings"
import { SettingsSidebar } from "./_components/SettingsSidebar"
import { GroupContent } from "./_components/GroupContent"
import { SettingsHeader } from "./_components/SettingsHeader"
import { DirtyFooter } from "./_components/DirtyFooter"
import { SettingsSkeleton } from "./_components/SettingsSkeleton"

export function ApiSettingsForm() {
  const t = useT("pages")
  const {
    loading,
    saving,
    rawSettings,
    values,
    originalValues,
    grouped,
    dirtySettings,
    fetchSettings,
    handleUpdate,
    handleReset,
    handleResetAll,
    handleSave,
  } = useApiSettings()

  const [activeGroup, setActiveGroup] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Initialize active group from grouped data
  const resolvedActiveGroup = useMemo(() => {
    if (activeGroup && grouped.some(g => g.group.key === activeGroup)) return activeGroup
    const first = grouped[0]
    return first ? first.group.key : ""
  }, [activeGroup, grouped])

  const dirtyCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const g of grouped) {
      counts[g.group.key] = g.items.filter(
        s => (values[s.name] ?? s.value) !== (originalValues[s.name] ?? s.value),
      ).length
    }
    return counts
  }, [grouped, values, originalValues])

  const totalDirty = dirtySettings.length
  const activeGroupData = grouped.find(g => g.group.key === resolvedActiveGroup)

  if (loading) return <SettingsSkeleton />

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <SettingsHeader
        totalSettings={rawSettings.length}
        totalGroups={grouped.length}
        totalDirty={totalDirty}
        saving={saving}
        onResetAll={handleResetAll}
        onRefresh={fetchSettings}
        onSave={handleSave}
      />
      <div className="flex flex-1 overflow-hidden">
        <SettingsSidebar
          grouped={grouped}
          dirtyCountByGroup={dirtyCountByGroup}
          activeGroup={resolvedActiveGroup}
          searchQuery={searchQuery}
          onSetActiveGroup={setActiveGroup}
          onSetSearchQuery={setSearchQuery}
        />
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {activeGroupData ? (
            <GroupContent
              grouped={activeGroupData}
              settings={values}
              originalSettings={originalValues}
              searchQuery={searchQuery}
              onUpdate={handleUpdate}
              onReset={handleReset}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Settings className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm">{t("api_settings.select_group")}</p>
            </div>
          )}
        </div>
      </div>
      <DirtyFooter totalDirty={totalDirty} saving={saving} onResetAll={handleResetAll} onSave={handleSave} />
    </div>
  )
}
