/**
 * Form Components for react-hook-form integration
 * Based on Shadcn UI Form pattern
 */

"use client"

import * as React from "react"
import { useFormContext, Controller, FieldPath, FieldValues, FormProvider } from "react-hook-form"
import { Label } from "@/ui/design-system/primitives/label"
import { cn } from "@/shared/utils"

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  _TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) => {
  // react-hook-form Controller props - complex generic type
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const { getFieldState, formState } = useFormContext()

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const fieldState = getFieldState(fieldContext.name, formState)

  return {
    name: fieldContext.name,
    ...fieldState,
  }
}

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("space-y-1.5", className)} {...props} />
  },
)
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<React.ElementRef<typeof Label>, React.ComponentPropsWithoutRef<typeof Label>>(
  ({ className, ...props }, ref) => {
    const { error } = useFormField()

    return (
      <Label
        ref={ref}
        className={cn(
          // Plain, calm label. The underlined ::after on focus was a
          // material-style accent that fought the focus ring on the input
          // beneath — two competing signals for the same focus state.
          // Error state still recolours the label red so the form error
          // is communicated by label colour + input border in parallel.
          "inline-flex items-center gap-1.5 text-sm font-medium text-foreground/85",
          error && "text-destructive",
          className,
        )}
        {...props}
      />
    )
  },
)
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => {
    const { error, name } = useFormField()

    return (
      <div
        ref={ref}
        id={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className="relative"
        {...props}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              "aria-invalid": !!error,
              "aria-describedby": error ? `${name}-error` : undefined,
            } as React.HTMLAttributes<HTMLElement>)
          }
          return child
        })}
      </div>
    )
  },
)
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    return <p ref={ref} className={cn("text-xs text-muted-foreground leading-relaxed", className)} {...props} />
  },
)
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children }, ref) => {
    const { error, name } = useFormField()

    // Attempt to extract the message, handling objects or stringified JSON
    let body: React.ReactNode = children
    if (error) {
      // Dynamic import moved to top of file - assuming getErrorMessage is imported
      body = typeof error === "string" ? error : error.message || String(error)
    }

    if (!body) {
      return null
    }

    return (
      // Compact inline error. The previous version used a pulsing bullet
      // + animation; both read as "look at me!" but every form has them
      // and the pulse + slide noise stacks. Plain text + destructive
      // colour + the input's red border already communicates the state.
      <p
        ref={ref}
        id={`${name}-error`}
        role="alert"
        className={cn("text-xs text-destructive mt-1.5 leading-tight", className)}
      >
        {body}
      </p>
    )
  },
)
FormMessage.displayName = "FormMessage"

const Form = FormProvider

export { useFormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, FormField, Form }
