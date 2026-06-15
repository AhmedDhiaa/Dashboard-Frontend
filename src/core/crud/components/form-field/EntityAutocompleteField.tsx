"use client"

import React from "react"
import {
  useFormContext,
  type ControllerRenderProps,
  type FieldValues,
  type ControllerFieldState,
} from "react-hook-form"
import { EntityAutocomplete } from "@/core/crud/components/EntityAutocomplete"
import {
  FormControl,
  FormDescription,
  FormField as ShadcnFormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/design-system/primitives/form"
import { cn } from "@/shared/utils"
import type { EntityAutocompleteFieldProps } from "./types"

const EntityAutocompleteFieldComponent = ({
  name,
  label,
  description,
  entityName,
  placeholder,
  searchPlaceholder,
  required,
  disabled,
  renderSelected,
  renderItem,
  clearable = true,
  hideLabel = false,
  className,
  multiple = false,
  valueKey,
  customEndpoint,
  basePath,
}: EntityAutocompleteFieldProps) => {
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
            <FormLabel className="dark:text-white">
              {label}
              {required && <span className="text-destructive ms-1">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <EntityAutocomplete
              entityName={entityName}
              value={field.value || undefined}
              onChange={value => field.onChange(value)}
              placeholder={placeholder ?? undefined}
              searchPlaceholder={searchPlaceholder ?? undefined}
              disabled={disabled ?? false}
              error={!!fieldState.error}
              renderSelected={renderSelected ?? undefined}
              renderItem={renderItem ?? undefined}
              clearable={clearable}
              multiple={multiple}
              valueKey={valueKey}
              customEndpoint={customEndpoint}
              basePath={basePath}
              className={cn("w-full", className)}
            />
          </FormControl>
          {description && <FormDescription className="dark:text-white/60">{description}</FormDescription>}
          <FormMessage className="text-destructive" />
        </FormItem>
      )}
    />
  )
}

export const EntityAutocompleteField = React.memo(EntityAutocompleteFieldComponent)
