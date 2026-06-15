/**
 * Dynamic List Field Component
 *
 * A reusable component for editing arrays of objects in forms.
 * Supports automated row management, layout, and various field types.
 */

"use client"

import { useFieldArray, useFormContext } from "react-hook-form"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { FormItem, FormLabel, FormMessage, FormDescription } from "@/ui/design-system/primitives/form"
import { TextField, SwitchField, EntityAutocompleteField, SelectField } from "./FormField"
import { useT } from "@/shared/config"
import { cn } from "@/shared/utils"

export interface DynamicListColumn {
  name: string
  label?: string
  labelKey?: string
  type: "text" | "number" | "autocomplete" | "boolean" | "textarea" | "select"
  entityName?: string
  options?: Array<{ value: string | number; label?: string; labelKey?: string }>
  placeholder?: string
  width?: string
  required?: boolean
}

export interface DynamicListFieldProps {
  name: string
  label: string
  description?: string
  columns: DynamicListColumn[]
  addButtonLabel?: string
  addButtonLabelKey?: string
  emptyMessage?: string
  emptyMessageKey?: string
  defaultRowValue: unknown
  maxItems?: number
  layout?: "card" | "table"
}

/**
 * Renders labels horizontally as a table header
 */
function DynamicListHeader({ columns }: { columns: DynamicListColumn[] }) {
  const t = useT()
  const colCount = columns.length

  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-2 border-b bg-muted/40 rounded-t-xl">
      {/* Spacer for Grip Icon */}
      <div className="w-8 shrink-0" />

      {/* Grid of Headers */}
      <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
        {columns.map(column => (
          <span
            key={column.name}
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate px-1"
          >
            {column.labelKey ? t(column.labelKey) : column.label || ""}
            {column.required && <span className="text-destructive ms-0.5">*</span>}
          </span>
        ))}
      </div>

      {/* Spacer for Remove Button */}
      <div className="w-8 shrink-0" />
    </div>
  )
}

/**
 * Renders a single row in the dynamic list
 */
function DynamicListRow({
  index,
  name,
  columns,
  onRemove,
  layout = "card",
}: {
  index: number
  name: string
  columns: DynamicListColumn[]
  onRemove: (index: number) => void
  layout?: "card" | "table"
}) {
  const isTable = layout === "table"
  const colCount = columns.length

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2 transition-all duration-300 animate-in fade-in slide-in-from-top-2",
        isTable
          ? "p-1 px-3 border-b hover:bg-muted/10 last:border-b-0 last:rounded-b-xl items-center"
          : "p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md",
      )}
    >
      <div className={cn("text-muted-foreground/30 shrink-0", isTable ? "mt-0" : "mt-3")}>
        <GripVertical className="h-5 w-5" />
      </div>

      <div
        className={cn(
          "flex-1 grid",
          isTable
            ? "gap-0" // "No space" as requested
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
        )}
        style={isTable ? { gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` } : undefined}
      >
        {columns.map(column => (
          <DynamicListFieldRenderer key={column.name} name={name} index={index} column={column} isTable={isTable} />
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        className={cn(
          "h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 shrink-0",
          isTable ? "mt-0" : "mt-8",
        )}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

/**
 * Individual field renderer for dynamic list rows
 * Extracted to reduce row complexity
 */
function DynamicListFieldRenderer({
  name,
  index,
  column,
  isTable,
}: {
  name: string
  index: number
  column: DynamicListColumn
  isTable: boolean
}) {
  const t = useT()
  const fieldName = `${name}.${index}.${column.name}`
  const fieldLabel = column.labelKey ? t(column.labelKey) : column.label || ""

  const baseClass = cn(
    "h-9 text-sm rounded-none border-0",
    isTable && "bg-transparent focus:bg-background focus:ring-0",
  )

  const props = { fieldName, fieldLabel, column, isTable, baseClass }

  switch (column.type) {
    case "number":
      return <DynamicListNumberField {...props} />
    case "autocomplete":
      return <DynamicListAutocompleteField {...props} />
    case "boolean":
      return <DynamicListBooleanField {...props} />
    case "select":
      return <DynamicListSelectField {...props} />
    default:
      return <DynamicListTextField {...props} />
  }
}

interface FieldRendererProps {
  fieldName: string
  fieldLabel: string
  column: DynamicListColumn
  isTable: boolean
  baseClass?: string
}

/** Specific renderers for each field type to keep complexity low */

function DynamicListNumberField({ fieldName, fieldLabel, column, isTable, baseClass }: FieldRendererProps) {
  return (
    <div className={cn(isTable && "border-e last:border-e-0")}>
      <TextField
        name={fieldName}
        label={fieldLabel}
        type="number"
        placeholder={column.placeholder}
        required={column.required}
        hideLabel={isTable}
        className={baseClass}
      />
    </div>
  )
}

function DynamicListAutocompleteField({ fieldName, fieldLabel, column, isTable }: FieldRendererProps) {
  return (
    <div className={cn(isTable && "border-e last:border-e-0")}>
      <EntityAutocompleteField
        name={fieldName}
        label={fieldLabel}
        entityName={column.entityName || ""}
        placeholder={column.placeholder}
        required={column.required}
        hideLabel={isTable}
        className={cn(
          "rounded-none",
          isTable ? "bg-transparent border-transparent focus:bg-background border-r-0" : "",
        )}
      />
    </div>
  )
}

function DynamicListBooleanField({ fieldName, fieldLabel, isTable }: FieldRendererProps) {
  return (
    <div className={cn("flex items-center justify-center", isTable && "h-9 border-r last:border-r-0")}>
      <SwitchField name={fieldName} label={fieldLabel} hideLabel={isTable} />
    </div>
  )
}

function DynamicListSelectField({ fieldName, fieldLabel, column, isTable, baseClass }: FieldRendererProps) {
  const t = useT()
  const options =
    column.options?.map(opt => ({
      value: opt.value,
      label: opt.labelKey ? t(opt.labelKey) : opt.label || String(opt.value),
    })) || []

  return (
    <div className={cn(isTable && "border-e last:border-e-0")}>
      <SelectField
        name={fieldName}
        label={fieldLabel}
        placeholder={column.placeholder}
        required={column.required}
        options={options}
        hideLabel={isTable}
        className={baseClass}
      />
    </div>
  )
}

function DynamicListTextField({ fieldName, fieldLabel, column, isTable, baseClass }: FieldRendererProps) {
  return (
    <div className={cn(isTable && "border-e last:border-e-0")}>
      <TextField
        name={fieldName}
        label={fieldLabel}
        placeholder={column.placeholder}
        required={column.required}
        hideLabel={isTable}
        className={baseClass}
      />
    </div>
  )
}

/**
 * Main DynamicListField component
 */
export function DynamicListField({
  name,
  label,
  description,
  columns,
  addButtonLabel = "Add Item",
  addButtonLabelKey,
  emptyMessage = "No items added yet.",
  emptyMessageKey,
  defaultRowValue,
  maxItems,
  layout = "card",
}: DynamicListFieldProps) {
  const { control } = useFormContext()
  const t = useT()
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  })

  const isTable = layout === "table"
  const resolvedAddButtonLabel = addButtonLabelKey ? t(addButtonLabelKey) : addButtonLabel
  const resolvedEmptyMessage = emptyMessageKey ? t(emptyMessageKey) : emptyMessage

  return (
    <FormItem className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <FormLabel className="text-base font-semibold">{label}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(defaultRowValue)}
          disabled={maxItems ? fields.length >= maxItems : false}
          className="h-8 gap-1.5 border-dashed hover:border-primary hover:bg-primary/5 transition-all"
        >
          <Plus className="h-4 w-4" />
          {resolvedAddButtonLabel}
        </Button>
      </div>

      <div className="space-y-3">
        {fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/20 text-muted-foreground italic text-sm">
            {resolvedEmptyMessage}
          </div>
        ) : (
          <div className={cn("space-y-3", isTable && "border rounded-xl space-y-0 overflow-hidden shadow-sm")}>
            {isTable && <DynamicListHeader columns={columns} />}
            {fields.map((field, index) => (
              <DynamicListRow
                key={field.id}
                index={index}
                name={name}
                columns={columns}
                onRemove={remove}
                layout={layout}
              />
            ))}
          </div>
        )}
      </div>
      <FormMessage />
    </FormItem>
  )
}
