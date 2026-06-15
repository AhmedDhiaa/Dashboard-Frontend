"use client"
import React, { useState, memo, useCallback, useMemo } from "react"
import { useT, useLocale } from "@/shared/config"
import { Filter, X, Calendar, Search } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"
import { useDrawer } from "@/ui/application/contexts/DrawerContext"
import type { FilterField } from "@/shared/types/filters"
import { countActiveFilters } from "@/shared/utils/filter-utils"
import { useMemoizedFilterOptions } from "@/shared/utils/filter-utils.hooks"
import { EntityAutocomplete } from "@/core/crud/components/EntityAutocomplete"
import { FilterMultiSelectField } from "./components/FilterMultiSelectField"
import { useEnumOptions } from "@/core/enums/useEnum"
import type { EnumTypeName } from "@/core/enums/enum.types"
// Re-export FilterField for convenience
export type { FilterField } from "@/shared/types/filters"

interface FilterDrawerContentProps {
  fields?: FilterField[]
  onApplyFilters?: (filters: Record<string, unknown>) => void
  initialFilters?: Record<string, unknown>
}

// Main Filter Drawer Content Component
export function FilterDrawerContent({ fields = [], onApplyFilters, initialFilters = {} }: FilterDrawerContentProps) {
  const { closeDrawer } = useDrawer()
  const t = useT()
  const [filters, setFilters] = useState<Record<string, unknown>>(initialFilters)
  const [term, setTerm] = useState<string>(
    (initialFilters.term as string) || (initialFilters.searchTerm as string) || "",
  )

  const handleApply = useCallback(() => {
    const allFilters = { ...filters, term: term.trim() }
    onApplyFilters?.(allFilters)
    closeDrawer()
  }, [filters, term, onApplyFilters, closeDrawer])

  const handleClearFilters = useCallback(() => {
    const clearedFilters: Record<string, unknown> = {}
    fields.forEach(field => {
      if (field.required && filters[field.name] !== undefined) {
        clearedFilters[field.name] = filters[field.name]
      }
    })
    const isTermRequired = fields.some(f => f.name === "term" && f.required)
    if (!isTermRequired) setTerm("")
    else if (filters.term !== undefined) clearedFilters.term = filters.term

    setFilters(clearedFilters)
    onApplyFilters?.(clearedFilters)
    closeDrawer()
  }, [fields, filters, onApplyFilters, closeDrawer])

  const handleFieldChange = useCallback((name: string, value: unknown) => {
    if (name === "term") setTerm(String(value))
    setFilters(prev => ({ ...prev, [name]: value }))
  }, [])

  const activeFiltersCount = countActiveFilters(filters) + (term.trim() ? 1 : 0)
  const clearableFiltersCount =
    Object.entries(filters).filter(([key, value]) => {
      if (value === undefined || value === null || (typeof value === "string" && !value.trim())) return false
      const field = fields.find(f => f.name === key)
      return !field?.required
    }).length + (term.trim() && !fields.some(f => f.name === "term" && f.required) ? 1 : 0)

  return (
    <div className="space-y-6">
      {!fields.some(f => f.name === "term") && (
        <FilterSearchHeader term={term} onTermChange={setTerm} onApply={handleApply} />
      )}

      {fields.length > 0 && (
        <>
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{t("Enum:filters:advanced_title")}</h3>
              <p className="text-xs text-muted-foreground">{t("Enum:filters:advanced_description")}</p>
            </div>
          </div>
          <div className="space-y-4">
            {fields.map(field => (
              <FilterFieldWrapper key={field.name} field={field}>
                <FilterFieldItem
                  field={field}
                  value={filters[field.name]}
                  fromValue={filters[`${field.name}_from`]}
                  toValue={filters[`${field.name}_to`]}
                  onChange={handleFieldChange}
                />
              </FilterFieldWrapper>
            ))}
          </div>
          <Button
            onClick={handleApply}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all"
          >
            <Filter className="h-4 w-4 me-2" />
            {t("Enum:filters:apply_button")}
          </Button>
        </>
      )}

      <Button
        onClick={handleClearFilters}
        variant="outline"
        className="w-full border-border"
        disabled={clearableFiltersCount === 0}
      >
        <X className="h-4 w-4 me-2" />
        {t("Enum:filters:clear_button")}
      </Button>

      {activeFiltersCount > 0 && (
        <div className="p-2 bg-success/5 border border-success/10 rounded-md text-[10px] text-muted-foreground text-center">
          {t("Enum:filters:active_filters", { count: activeFiltersCount })}
        </div>
      )}
    </div>
  )
}

/** Quick Search Header component — extracted to keep main component short */
const FilterSearchHeader = memo(function FilterSearchHeader({
  term,
  onTermChange,
  onApply,
}: {
  term: string
  onTermChange: (val: string) => void
  onApply: () => void
}) {
  const t = useT()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="p-2 rounded-lg bg-gradient-to-br from-success to-success/80 text-success-foreground">
          <Search className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{t("Enum:filters:quick_search_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("Enum:filters:quick_search_description")}</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            placeholder={t("Enum:filters:search_placeholder")}
            value={term}
            onChange={e => onTermChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onApply()}
            className="ps-10 h-11 bg-muted border-border focus:border-success text-base"
            dir="auto"
          />
        </div>
        <Button
          onClick={onApply}
          className="w-full bg-gradient-to-r from-success to-success/80 text-success-foreground"
        >
          <Search className="h-4 w-4 me-2" />
          {t("common.search")}
        </Button>
      </div>
    </div>
  )
})

const FilterFieldWrapper = memo(function FilterFieldWrapper({
  field,
  children,
}: {
  field: FilterField
  children: React.ReactNode
}) {
  const t = useT()
  const label = field.label.includes(":") || field.label.includes(".") ? t(field.label) : field.label
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  )
})

/** Core rendering logic for individual fields — separated to reduce complexity */
const FilterFieldItem = memo(function FilterFieldItem({
  field,
  value,
  fromValue,
  toValue,
  onChange,
}: {
  field: FilterField
  value: unknown
  fromValue: unknown
  toValue: unknown
  onChange: (name: string, value: unknown) => void
}) {
  switch (field.type) {
    case "text":
      return <FilterTextField field={field} value={value} onChange={onChange} />
    case "select":
      return <FilterSelectField field={field} value={value} onChange={onChange} />
    case "multi-select":
      return <FilterMultiSelectField field={field} value={value} onChange={onChange} />
    case "date":
      return <FilterDateField field={field} value={value} onChange={onChange} />
    case "daterange":
      return <FilterDateRangeField field={field} fromValue={fromValue} toValue={toValue} onChange={onChange} />
    case "autocomplete":
      return <FilterAutocompleteField field={field} value={value} onChange={onChange} />
    default:
      return null
  }
})

const FilterTextField = memo(function FilterTextField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: unknown
  onChange: (name: string, value: unknown) => void
}) {
  const t = useT()
  return (
    <div className="relative">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
      <Input
        placeholder={
          field.placeholder && (field.placeholder.includes(":") || field.placeholder.includes("."))
            ? t(field.placeholder)
            : field.placeholder || t("common.placeholders.search")
        }
        value={(value as string) || ""}
        disabled={field.disabled}
        onChange={e => onChange(field.name, e.target.value)}
        className="ps-9 h-9 bg-muted border-border font-medium text-xs py-1.5"
      />
    </div>
  )
})

const FilterDateField = memo(function FilterDateField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: unknown
  onChange: (name: string, value: unknown) => void
}) {
  return (
    <div className="relative">
      <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
      <Input
        type="date"
        value={(value as string) || ""}
        disabled={field.disabled}
        onChange={e => onChange(field.name, e.target.value)}
        className="ps-9 h-9 bg-muted border-border text-xs font-medium"
        dir="auto"
      />
    </div>
  )
})

const FilterDateRangeField = memo(function FilterDateRangeField({
  field,
  fromValue,
  toValue,
  onChange,
}: {
  field: FilterField
  fromValue: unknown
  toValue: unknown
  onChange: (name: string, value: unknown) => void
}) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative">
        <Calendar className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
        <Input
          type="date"
          placeholder={t("common.from")}
          value={(fromValue as string) || ""}
          disabled={field.disabled}
          onChange={e => onChange(`${field.name}_from`, e.target.value)}
          className="ps-8 h-9 bg-muted border-border text-[10px]"
        />
      </div>
      <div className="relative">
        <Calendar className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
        <Input
          type="date"
          placeholder={t("common.to")}
          value={(toValue as string) || ""}
          disabled={field.disabled}
          onChange={e => onChange(`${field.name}_to`, e.target.value)}
          className="ps-8 h-9 bg-muted border-border text-[10px]"
        />
      </div>
    </div>
  )
})

const FilterAutocompleteField = memo(function FilterAutocompleteField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: unknown
  onChange: (name: string, value: unknown) => void
}) {
  const t = useT()
  return (
    <EntityAutocomplete
      entityName={field.entityName || ""}
      value={value as string}
      disabled={field.disabled}
      onChange={val => onChange(field.name, val)}
      placeholder={
        field.placeholder && (field.placeholder.includes(":") || field.placeholder.includes("."))
          ? t(field.placeholder)
          : t("common.placeholders.search")
      }
      className="h-9 bg-muted border-border"
      valueKey={field.valueKey}
      customEndpoint={field.customEndpoint}
      basePath={field.basePath}
    />
  )
})

const FilterSelectField = memo(function FilterSelectField({
  field,
  value,
  onChange,
}: {
  field: FilterField
  value: unknown
  onChange: (name: string, value: unknown) => void
}) {
  const t = useT()
  const { isRTL } = useLocale()
  const { options: enumOptions, loading: enumLoading } = useEnumOptions(field.enumType as EnumTypeName)
  const staticOptions = useMemoizedFilterOptions(field.options, t)

  const options = useMemo(() => {
    return field.enumType ? enumOptions.map(opt => ({ ...opt, translatedLabel: opt.label })) : staticOptions
  }, [field.enumType, enumOptions, staticOptions])

  const placeholder = useMemo(() => {
    if (!field.placeholder) return t("common.placeholders.select")
    const isKey = field.placeholder.includes(":") || field.placeholder.includes(".")
    return isKey ? t(field.placeholder) : field.placeholder
  }, [field.placeholder, t])

  const direction = field.direction || (isRTL ? "rtl" : "ltr")

  return (
    <Select
      value={value !== undefined && value !== null ? String(value) : ""}
      onValueChange={val => onChange(field.name, val)}
      disabled={field.disabled || (!!field.enumType && enumLoading)}
    >
      <SelectTrigger dir={direction} className="bg-muted border-border text-xs h-9">
        <SelectValue placeholder={field.enumType && enumLoading ? t("common.loading") : placeholder} />
      </SelectTrigger>
      <SelectContent dir={direction}>
        {options.map(opt => (
          <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
            {opt.translatedLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
})

export function useFilterDrawer() {
  const { openDrawer } = useDrawer()
  const t = useT()
  return {
    openFilters: (p: FilterDrawerContentProps, title?: string) => {
      openDrawer(<FilterDrawerContent {...p} />, title || t("Enum:filters:title"))
    },
  }
}
