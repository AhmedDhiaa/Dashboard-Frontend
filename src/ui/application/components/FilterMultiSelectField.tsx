"use client"
// Calls client-only hooks or imports a client-only package
// (recharts, framer-motion, cmdk, etc.). Required to be a
// Client Component — enforced by scripts/check-rsc-boundaries.mjs.

import React, { memo, useMemo, useState } from "react"
import { Check, Filter, X, Search } from "lucide-react"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Button } from "@/ui/design-system/primitives/button"
import { Checkbox } from "@/ui/design-system/primitives/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/design-system/primitives/popover"
import { Input } from "@/ui/design-system/primitives/input"
import { useT, useLocale } from "@/shared/config"
import { useMemoizedFilterOptions } from "@/shared/utils/filter-utils.hooks"
import { cn } from "@/shared/utils"
import type { FilterField } from "@/shared/types/filters"
import { useEnumOptions } from "@/core/enums/useEnum"
import type { EnumTypeName } from "@/core/enums/enum.types"

interface MultiSelectFieldProps {
  field: FilterField
  value: unknown
  onChange: (name: string, value: unknown) => void
}

/** Multi-select field — simpler implementation without cmdk to avoid visibility issues */
export const FilterMultiSelectField = memo(function FilterMultiSelectField({
  field,
  value,
  onChange,
}: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const t = useT()
  const { isRTL } = useLocale()

  const { options: enumOptions, loading: enumLoading } = useEnumOptions(field.enumType as EnumTypeName)

  const staticOptions = useMemoizedFilterOptions(field.options, t)

  const translatedOptions = useMemo(() => {
    return field.enumType ? enumOptions.map(opt => ({ ...opt, translatedLabel: opt.label })) : staticOptions
  }, [field.enumType, enumOptions, staticOptions])

  const selected = useMemo(() => {
    if (Array.isArray(value)) return value as (string | number)[]
    if (value !== undefined && value !== null && value !== "") return [value as string | number]
    return []
  }, [value])

  const toggle = (optVal: string | number) => {
    const strVal = String(optVal)
    const isSelected = selected.some(v => String(v) === strVal)
    const next = isSelected
      ? selected.filter(v => String(v) !== strVal)
      : [...selected, typeof optVal === "string" ? Number(optVal) || optVal : optVal]
    onChange(field.name, next.length > 0 ? next : undefined)
  }

  const filteredOptions = useMemo(() => {
    if (!search) return translatedOptions
    const searchLower = search.toLowerCase()
    return translatedOptions.filter(opt => opt.translatedLabel.toLowerCase().includes(searchLower))
  }, [search, translatedOptions])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FilterMultiSelectTrigger
          field={field}
          selected={selected}
          translatedOptions={translatedOptions}
          enumLoading={enumLoading}
          onClear={() => onChange(field.name, undefined)}
        />
      </PopoverTrigger>
      <PopoverContent
        className="z-[9999] w-[300px] min-h-[200px] p-0 overflow-hidden bg-background border-2 border-primary shadow-xl rounded-md"
        align="start"
        dir={field.direction || (isRTL ? "rtl" : "ltr")}
      >
        <div className="flex flex-col h-full max-h-[300px]">
          <div className="flex items-center border-b px-2 py-1">
            <Search className="h-3.5 w-3.5 opacity-50 me-2" />
            <Input
              placeholder={t("common.search")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 border-none focus-visible:ring-0 text-xs px-0 bg-transparent"
            />
          </div>

          <div className="overflow-y-auto p-1 py-1.5 flex flex-col gap-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs opacity-50">{t("common.no_results_found")}</div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={String(option.value)}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                    selected.some(v => String(v) === String(option.value)) && "bg-accent/50",
                  )}
                >
                  <Checkbox
                    checked={selected.some(v => String(v) === String(option.value))}
                    onCheckedChange={() => toggle(option.value)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="truncate flex-1">{option.translatedLabel}</span>
                  {selected.some(v => String(v) === String(option.value)) && (
                    <Check className="h-3 w-3 text-primary shrink-0 ms-auto" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
})

/** Trigger button for multi-select drawer */
const FilterMultiSelectTrigger = memo(function FilterMultiSelectTrigger({
  field,
  selected,
  translatedOptions,
  enumLoading,
  onClear,
  ...props
}: {
  field: FilterField
  selected: (string | number)[]
  translatedOptions: Array<{ value: string | number; translatedLabel: string }>
  enumLoading: boolean
  onClear: () => void
} & React.ComponentPropsWithoutRef<typeof Button>) {
  const t = useT()
  const placeholder =
    field.placeholder && (field.placeholder.includes(":") || field.placeholder.includes("."))
      ? t(field.placeholder)
      : field.placeholder || t("common.placeholders.select")

  const selectedLabels = useMemo(
    () =>
      translatedOptions
        .filter(opt => selected.some(s => String(s) === String(opt.value)))
        .map(opt => opt.translatedLabel),
    [translatedOptions, selected],
  )

  const isDisabled = field.disabled || (!!field.enumType && enumLoading)

  return (
    <Button
      variant="outline"
      disabled={isDisabled}
      role="combobox"
      className={cn(
        "w-full justify-between h-10 bg-muted border-border hover:bg-muted/80 font-normal px-3",
        isDisabled && "opacity-50 pointer-events-none cursor-not-allowed",
      )}
      dir={field.direction}
      {...props}
    >
      <div className="flex items-center gap-2 truncate">
        {field.enumType && enumLoading ? (
          <span className="text-muted-foreground text-xs">{t("common.loading")}</span>
        ) : selected.length > 0 ? (
          <>
            <Badge variant="secondary" className="px-1.5 h-5 font-semibold text-[10px] rounded-sm">
              {selected.length}
            </Badge>
            <span className="truncate text-xs">{selectedLabels.join(", ")}</span>
          </>
        ) : (
          <span className="text-muted-foreground text-xs">{placeholder}</span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {selected.length > 0 && !field.disabled && (
          <X
            className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={e => {
              e.stopPropagation()
              onClear()
            }}
          />
        )}
        <Filter className="h-3 w-3 opacity-50" />
      </div>
    </Button>
  )
})
