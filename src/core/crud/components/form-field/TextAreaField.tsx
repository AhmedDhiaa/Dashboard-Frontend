"use client"

import {
  useFormContext,
  type ControllerRenderProps,
  type FieldValues,
  type ControllerFieldState,
} from "react-hook-form"
import { Textarea } from "@/ui/design-system/primitives/textarea"
import {
  FormControl,
  FormDescription,
  FormField as ShadcnFormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/design-system/primitives/form"
import { cn } from "@/shared/utils"
import type { TextAreaFieldProps } from "./types"

export function TextAreaField({
  name,
  label,
  description,
  placeholder,
  rows = 4,
  required,
  disabled,
  className,
  hideLabel = false,
}: TextAreaFieldProps) {
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
            <Textarea
              {...field}
              error={!!fieldState.error}
              placeholder={placeholder}
              rows={rows}
              disabled={disabled}
              className={cn(
                "border-border dark:border-border bg-background dark:bg-surface-dark/50 text-foreground dark:text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground focus-visible:ring-emerald-500 dark:focus-visible:ring-emerald-400 focus-visible:border-emerald-500 dark:focus-visible:border-emerald-400 transition-all duration-200 resize-none",
                className,
              )}
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
