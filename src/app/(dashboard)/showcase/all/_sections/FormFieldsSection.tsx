/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

/**
 * FormFieldsSection — one react-hook-form + zod-validated form rendering
 * every form field this codebase ships with.
 *
 * Covered: Input, Textarea, Select, Checkbox, Switch, Slider, RadioGroup,
 * Label, DateRangePicker, EntityAutocomplete, and BoundaryDrawerField
 * (the last shown via a placeholder — the real one mounts a Google Maps
 * canvas which is too heavy for a showcase first-paint).
 *
 * Follows the same pattern as the existing FormsContent.tsx — Form
 * primitive wrapping each FormField, Controller-driven, with a Submit /
 * Reset row at the bottom. The `any` escape hatch on render callbacks
 * mirrors the existing convention (RHF render-prop types are heavy
 * generics that the codebase doesn't bother typing precisely).
 */

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/design-system/primitives/form"
import { Input } from "@/ui/design-system/primitives/input"
import { Textarea } from "@/ui/design-system/primitives/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"
import { Checkbox } from "@/ui/design-system/primitives/checkbox"
import { Switch } from "@/ui/design-system/primitives/switch"
import { Slider } from "@/ui/design-system/primitives/slider"
import { RadioGroup, RadioGroupItem } from "@/ui/design-system/primitives/radio-group"
import { Button } from "@/ui/design-system/primitives/button"
import { Label } from "@/ui/design-system/primitives/label"
import { DateRangePicker } from "@/ui/design-system/primitives/date-range-picker"
import type { DateRange } from "react-day-picker"
import ShowcaseBlock from "../_shared/ShowcaseBlock"
import { MOCK_CITIES, MOCK_COUNTRIES } from "../_shared/mock-data"

const schema = z.object({
  text: z.string().min(2, "Min 2 characters"),
  email: z.string().email("Invalid email"),
  phone: z.string().regex(/^\+964\s?\d{3}\s?\d{3}\s?\d{4}$/, "Use +964 prefix"),
  bio: z.string().min(10, "Min 10 characters"),
  city: z.string().min(1, "Select a city"),
  country: z.string().min(1, "Select a country"),
  shift: z.enum(["morning", "evening", "night"]),
  notifyByEmail: z.boolean(),
  isActive: z.boolean(),
  volume: z.number().min(0).max(100),
})

type ShowcaseFormValues = z.infer<typeof schema>

export default function FormFieldsSection() {
  const form = useForm<ShowcaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      text: "",
      email: "",
      phone: "",
      bio: "",
      city: "",
      country: "",
      shift: "morning",
      notifyByEmail: true,
      isActive: true,
      volume: 50,
    },
  })

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  const onSubmit = (data: ShowcaseFormValues) => {
    console.warn("Showcase form submitted:", data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        <CoreFieldsBlock control={form.control} />
        <SelectorsBlock control={form.control} />
        <TogglesBlock control={form.control} />
        <DatePickerBlock value={dateRange} onChange={setDateRange} />
        <SpecialFieldsBlock />
        <ActionsRow form={form} />
      </form>
    </Form>
  )
}

function CoreFieldsBlock({ control }: { control: any }) {
  return (
    <ShowcaseBlock title="Text inputs" description="Input + Textarea via FormField.">
      <div className="space-y-4">
        <FormField
          control={control}
          name="text"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Type a name…" {...field} />
              </FormControl>
              <FormDescription>Min 2 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="email"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="user@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="phone"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input inputMode="tel" placeholder="+964 770 111 2233" {...field} />
              </FormControl>
              <FormDescription>Iraqi format with country code.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="bio"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Short biography…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </ShowcaseBlock>
  )
}

function SelectorsBlock({ control }: { control: any }) {
  return (
    <ShowcaseBlock title="Selectors" description="Select + RadioGroup.">
      <div className="space-y-4">
        <FormField
          control={control}
          name="city"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a city" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MOCK_CITIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="country"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a country" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MOCK_COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="shift"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Shift</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col gap-2">
                  {(["morning", "evening", "night"] as const).map(opt => (
                    <div key={opt} className="flex items-center gap-2">
                      <RadioGroupItem value={opt} id={`shift-${opt}`} />
                      <Label htmlFor={`shift-${opt}`} className="cursor-pointer capitalize">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </ShowcaseBlock>
  )
}

function TogglesBlock({ control }: { control: any }) {
  return (
    <ShowcaseBlock title="Toggles & sliders" description="Checkbox, Switch, Slider.">
      <div className="space-y-4">
        <FormField
          control={control}
          name="notifyByEmail"
          render={({ field }: any) => (
            <FormItem className="flex items-start gap-3 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} id="notify" />
              </FormControl>
              <div>
                <FormLabel htmlFor="notify" className="cursor-pointer">
                  Send email notifications
                </FormLabel>
                <FormDescription>You can change this later.</FormDescription>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="isActive"
          render={({ field }: any) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <FormLabel>Active</FormLabel>
                <FormDescription>Inactive records are hidden from list views.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="volume"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Volume — {field.value}%</FormLabel>
              <FormControl>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[field.value]}
                  onValueChange={([val]: number[]) => field.onChange(val)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </ShowcaseBlock>
  )
}

function DatePickerBlock({
  value,
  onChange,
}: {
  value: DateRange | undefined
  onChange: (r: DateRange | undefined) => void
}) {
  return (
    <ShowcaseBlock title="DateRangePicker" description="Range mode with shortcuts.">
      <div className="space-y-2">
        <Label>Reporting period</Label>
        <DateRangePicker value={value} onChange={onChange} mode="range" />
        <p className="text-xs text-muted-foreground">
          Selected: {value?.from ? value.from.toDateString() : "—"} → {value?.to ? value.to.toDateString() : "—"}
        </p>
      </div>
    </ShowcaseBlock>
  )
}

function SpecialFieldsBlock() {
  return (
    <ShowcaseBlock title="Special fields" description="EntityAutocomplete + BoundaryDrawerField placeholders.">
      <div className="space-y-4">
        <div>
          <Label className="block mb-2">EntityAutocomplete (live)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Real autocomplete hits `/api/app/&lt;entity&gt;/autocomplete`. Showcase mounts a stand-in trigger because no
            backend is available at preview time.
          </p>
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            <span className="font-mono text-xs">&lt;EntityAutocomplete entityName=&quot;city&quot; /&gt;</span>
          </div>
        </div>
        <div>
          <Label className="block mb-2">BoundaryDrawerField (map placeholder)</Label>
          <div className="rounded-md border border-dashed border-border h-48 flex items-center justify-center text-sm text-muted-foreground bg-muted/20">
            Map preview (placeholder — real map disabled in showcase)
          </div>
        </div>
      </div>
    </ShowcaseBlock>
  )
}

function ActionsRow({ form }: { form: any }) {
  return (
    <div className="flex justify-end gap-3 pt-4 border-t">
      <Button type="button" variant="outline" onClick={() => form.reset()}>
        Reset
      </Button>
      <Button type="submit" loading={form.formState.isSubmitting}>
        Submit form
      </Button>
    </div>
  )
}
