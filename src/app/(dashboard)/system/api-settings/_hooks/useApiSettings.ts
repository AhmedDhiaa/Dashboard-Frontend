"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { securityService } from "@/domains/system/security.service"
import type { ApiSetting } from "@/shared/types/security.types"
import { useNotification } from "@/ui/application/hooks/useNotification"
import { groupSettings } from "../_utils"

export function useApiSettings() {
  const notify = useNotification()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rawSettings, setRawSettings] = useState<ApiSetting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({})

  const providerName = "G"
  const providerKey = ""

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await securityService.getApiSettings(providerName, providerKey, true)
      setRawSettings(data)
      const vals: Record<string, string> = {}
      data.forEach(s => {
        vals[s.name] = s.value
      })
      setValues(vals)
      setOriginalValues({ ...vals })
    } catch (error) {
      notify.error(error)
    } finally {
      setLoading(false)
    }
  }, [providerName, providerKey, notify])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleUpdate = useCallback((name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleReset = useCallback(
    (name: string) => {
      setValues(prev => ({ ...prev, [name]: originalValues[name] ?? "" }))
    },
    [originalValues],
  )

  const handleResetAll = useCallback(() => {
    setValues({ ...originalValues })
  }, [originalValues])

  const dirtySettings = useMemo(() => {
    const dirty: ApiSetting[] = []
    for (const s of rawSettings) {
      if (values[s.name] !== originalValues[s.name]) {
        dirty.push({ name: s.name, value: values[s.name] ?? s.value })
      }
    }
    return dirty
  }, [rawSettings, values, originalValues])

  const handleSave = useCallback(async () => {
    if (dirtySettings.length === 0) return
    try {
      setSaving(true)
      await securityService.updateApiSettings(providerName, providerKey, dirtySettings, true)
      setOriginalValues({ ...values })
      notify.success("common.messages.successUpdate")
    } catch (error) {
      notify.error(error)
    } finally {
      setSaving(false)
    }
  }, [dirtySettings, values, providerName, providerKey, notify])

  const grouped = useMemo(() => groupSettings(rawSettings), [rawSettings])

  return {
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
  }
}
