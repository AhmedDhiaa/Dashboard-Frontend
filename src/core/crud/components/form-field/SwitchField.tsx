"use client"

import { useFormContext, type ControllerRenderProps, type FieldValues } from "react-hook-form"
import { Switch } from "@/ui/design-system/primitives/switch"
import {
  FormControl,
  FormDescription,
  FormField as ShadcnFormField,
  FormItem,
  FormLabel,
} from "@/ui/design-system/primitives/form"
import { cn } from "@/shared/utils"
import type { SwitchFieldProps } from "./types"

export function SwitchField({ name, label, description, disabled, className, hideLabel = false }: SwitchFieldProps) {
  const { control } = useFormContext()

  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({ field }: { field: ControllerRenderProps<FieldValues, string> }) => (
        <FormItem
          className={cn(
            hideLabel
              ? "flex items-center justify-center border-0 bg-transparent p-0 shadow-none hover:shadow-none"
              : "flex flex-row items-center justify-between rounded-xl border bg-muted/30 p-4 shadow-sm hover:shadow-md transition-all duration-200",
            className,
          )}
        >
          {!hideLabel && (
            <div className="space-y-0.5">
              <FormLabel className="text-base font-medium text-foreground dark:text-foreground">{label}</FormLabel>
              {description && (
                <FormDescription className="text-xs text-muted-foreground dark:text-muted-foreground">
                  {description}
                </FormDescription>
              )}
            </div>
          )}
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  )
}
