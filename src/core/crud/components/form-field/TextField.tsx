"use client"

import {
  useFormContext,
  type ControllerRenderProps,
  type FieldValues,
  type ControllerFieldState,
} from "react-hook-form"
import { Input } from "@/ui/design-system/primitives/input"
import {
  FormControl,
  FormDescription,
  FormField as ShadcnFormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/design-system/primitives/form"
import type { TextFieldProps } from "./types"

export function TextField({
  name,
  label,
  description,
  placeholder,
  type = "text",
  required,
  disabled,
  className,
  min,
  max,
  step,
  hideLabel = false,
}: TextFieldProps) {
  const { control } = useFormContext()

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
        <FormItem>
          {!hideLabel && (
            <FormLabel className="text-sm font-medium text-foreground dark:text-foreground">
              {label}
              {required && <span className="text-destructive ms-1">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <Input
              {...field}
              type={type}
              error={!!fieldState.error}
              onChange={e => {
                const value = e.target.value
                if (type === "number") {
                  if (value === "") {
                    field.onChange(undefined)
                  } else {
                    const num = parseFloat(value)
                    field.onChange(isNaN(num) ? value : num)
                  }
                } else {
                  field.onChange(value)
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
              min={min}
              max={max}
              step={step}
              className={
                className ||
                "h-11 border-border dark:border-border bg-background dark:bg-surface-dark/50 text-foreground dark:text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus-visible:ring-primary/50 focus-visible:border-primary transition-all duration-200"
              }
            />
          </FormControl>
          {description && (
            <FormDescription className="text-xs text-muted-foreground dark:text-muted-foreground">
              {description}
            </FormDescription>
          )}
          <FormMessage className="text-xs text-destructive" />
        </FormItem>
      )}
    />
  )
}
