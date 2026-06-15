"use client"

import {
  useFormContext,
  type ControllerRenderProps,
  type FieldValues,
  type ControllerFieldState,
} from "react-hook-form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"
import {
  FormControl,
  FormDescription,
  FormField as ShadcnFormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/design-system/primitives/form"
import { cn } from "@/shared/utils"
import { useLayout } from "@/ui/layout/LayoutContext"
import type { SelectFieldProps } from "./types"

export function SelectField({
  name,
  label,
  description,
  options,
  placeholder,
  required,
  disabled,
  hideLabel,
  className,
  direction,
}: SelectFieldProps) {
  const { control } = useFormContext()
  const { direction: layoutDirection } = useLayout()
  const effectiveDirection = direction || layoutDirection

  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({
        field,
        fieldState,
      }: {
        field: ControllerRenderProps<FieldValues, string>
        fieldState: ControllerFieldState
      }) => (
        <FormItem className={className}>
          {!hideLabel && (
            <FormLabel className="dark:text-white">
              {label}
              {required && <span className="text-destructive ms-1">*</span>}
            </FormLabel>
          )}
          <Select
            onValueChange={val => {
              // Try to find the original option to preserve the type (string vs number)
              const selectedOption = options.find(opt => String(opt.value) === val)
              field.onChange(selectedOption ? selectedOption.value : val)
            }}
            value={field.value !== undefined && field.value !== null ? String(field.value) : undefined}
            disabled={disabled ?? false}
            dir={effectiveDirection}
          >
            <FormControl>
              <SelectTrigger
                className={cn(
                  "dark:bg-surface-dark dark:border-border dark:text-foreground",
                  fieldState.error && "border-destructive ring-destructive/20",
                )}
                aria-invalid={!!fieldState.error}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="dark:bg-surface-dark dark:border-border">
              {options.map((option, idx) => (
                <SelectItem
                  key={`${option.value}-${idx}`}
                  value={String(option.value)}
                  className="dark:text-foreground dark:focus:bg-surface-dark-secondary"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription className="dark:text-white/60">{description}</FormDescription>}
          <FormMessage className="text-destructive" />
        </FormItem>
      )}
    />
  )
}
