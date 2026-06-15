"use client"

import { useState } from "react"
import {
  useFormContext,
  type ControllerRenderProps,
  type FieldValues,
  type ControllerFieldState,
} from "react-hook-form"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Input } from "@/ui/design-system/primitives/input"
import { Button } from "@/ui/design-system/primitives/button"
import { Badge } from "@/ui/design-system/primitives/badge"
import {
  FormControl,
  FormDescription,
  FormField as ShadcnFormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/design-system/primitives/form"
import { cn } from "@/shared/utils"
import type { TagsFieldProps } from "./types"

/**
 * Chip-style array editor for `type: "tags"` form fields.
 *
 * Mirrors the runtime-builder's TagsControl (DynamicForm.tsx) behavior so
 * an entity preview and its materialized form render identically. Intentionally
 * keeps the two implementations separate — TagsControl is self-contained
 * (no react-hook-form), while this one integrates with the form-field
 * engine's Controller pattern. Extract a shared chip primitive if a third
 * consumer emerges.
 */
export function TagsField(props: TagsFieldProps) {
  const { control } = useFormContext()
  return (
    <ShadcnFormField
      control={control}
      name={props.name}
      render={({
        field,
        fieldState,
      }: {
        field: ControllerRenderProps<FieldValues, string>
        fieldState: ControllerFieldState
      }) => <TagsFieldInner props={props} field={field} fieldState={fieldState} />}
    />
  )
}

interface InnerProps {
  props: TagsFieldProps
  field: ControllerRenderProps<FieldValues, string>
  fieldState: ControllerFieldState
}

function TagsFieldInner({ props, field, fieldState }: InnerProps) {
  const { label, description, placeholder, required, disabled, hideLabel, className, maxCount, allowDuplicates } = props
  const t = useTranslations()
  const [draft, setDraft] = useState("")
  const tags: string[] = Array.isArray(field.value) ? (field.value as string[]) : []
  const atCap = maxCount != null && tags.length >= maxCount

  const commit = () => {
    const next = draft.trim()
    if (!next) return
    if (!allowDuplicates && tags.includes(next)) {
      setDraft("")
      return
    }
    if (atCap) return
    field.onChange([...tags, next])
    setDraft("")
  }

  const remove = (index: number) => {
    field.onChange(tags.filter((_, i) => i !== index))
  }

  return (
    <FormItem className={className}>
      {!hideLabel && (
        <FormLabel className="dark:text-white">
          {label}
          {required && <span className="text-destructive ms-1">*</span>}
        </FormLabel>
      )}
      <FormControl>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={draft}
              placeholder={placeholder ?? "Type and press Enter…"}
              disabled={disabled || atCap}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  commit()
                }
              }}
              aria-invalid={!!fieldState.error}
              className={cn(
                "dark:bg-surface-dark dark:border-border dark:text-foreground",
                fieldState.error && "border-destructive ring-destructive/20",
              )}
            />
            <Button
              type="button"
              variant="outline"
              onClick={commit}
              disabled={disabled || atCap || draft.trim() === ""}
            >
              {t("common.add")}
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, i) => (
                <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1 pe-1">
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={disabled}
                    aria-label={`Remove ${tag}`}
                    className="rounded-sm p-0.5 hover:bg-muted/60 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </FormControl>
      {description && <FormDescription className="dark:text-white/60">{description}</FormDescription>}
      <FormMessage className="text-destructive" />
    </FormItem>
  )
}
