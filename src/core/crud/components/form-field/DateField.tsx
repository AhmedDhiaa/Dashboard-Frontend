"use client"

import { useFormContext, type ControllerRenderProps, type FieldValues } from "react-hook-form"
import {
  FormControl,
  FormDescription,
  FormField as ShadcnFormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/design-system/primitives/form"
import { cn } from "@/shared/utils"
import { Button } from "@/ui/design-system/primitives/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/design-system/primitives/popover"
import { Calendar } from "@/ui/design-system/primitives/calendar"
import { format, parseISO, isValid } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react"
import type { TextFieldProps } from "./types"

export function DateField({
  name,
  label,
  description,
  placeholder,
  required,
  disabled,
  className,
  hideLabel = false,
}: TextFieldProps) {
  const { control } = useFormContext()

  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({ field }: { field: ControllerRenderProps<FieldValues, string> }) => {
        const dateValue = field.value
          ? typeof field.value === "string"
            ? parseISO(field.value)
            : field.value
          : undefined
        const isDateValid = dateValue && isValid(dateValue)

        return (
          <FormItem className={className}>
            {!hideLabel && (
              <FormLabel className="text-sm font-medium text-foreground dark:text-foreground">
                {label}
                {required && <span className="text-destructive ms-1">*</span>}
              </FormLabel>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full h-11 justify-start text-start font-normal px-4 rounded-xl border-border dark:border-border bg-background dark:bg-surface-dark/50 hover:bg-accent/50 transition-all duration-200",
                      !field.value && "text-muted-foreground",
                    )}
                    disabled={disabled}
                  >
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center me-3 shrink-0">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="flex-1 truncate grayscale-[0.5]">
                      {isDateValid ? format(dateValue, "PPP") : placeholder || "Pick a date"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground/50 ms-2" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl border-border shadow-xl z-[100]" align="start">
                <Calendar
                  mode="single"
                  selected={isDateValid ? dateValue : undefined}
                  onSelect={date => {
                    if (date) {
                      field.onChange(date.toISOString())
                    } else {
                      field.onChange(null)
                    }
                  }}
                  disabled={disabled}
                  initialFocus
                  className="rounded-2xl"
                />
              </PopoverContent>
            </Popover>
            {description && (
              <FormDescription className="text-xs text-muted-foreground dark:text-muted-foreground">
                {description}
              </FormDescription>
            )}
            <FormMessage className="text-xs text-destructive" />
          </FormItem>
        )
      }}
    />
  )
}
