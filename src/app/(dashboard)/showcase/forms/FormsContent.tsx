/* eslint-disable @typescript-eslint/no-explicit-any */

"use client"

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
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Label } from "@/ui/design-system/primitives/label"

const showcaseSchema = z.object({
  text: z.string().min(2, "Min 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
  textarea: z.string().min(10, "Min 10 characters"),
  select: z.string().min(1, "Please select an option"),
  radio: z.enum(["option1", "option2", "option3"]),
  checkbox: z.boolean(),
  toggle: z.boolean(),
  slider: z.number().min(0).max(100),
})

type ShowcaseFormValues = z.infer<typeof showcaseSchema>

export function FormsContent() {
  const form = useForm<ShowcaseFormValues>({
    resolver: zodResolver(showcaseSchema),
    defaultValues: {
      text: "",
      email: "",
      password: "",
      textarea: "",
      select: "",
      radio: "option1",
      checkbox: false,
      toggle: true,
      slider: 40,
    },
  })

  const onSubmit = (data: ShowcaseFormValues) => {
    console.warn("Form submitted:", data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Complete Form Example</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="text"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Text Input</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter text..." {...field} />
                  </FormControl>
                  <FormDescription>Min 2 characters required</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
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
              control={form.control}
              name="password"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="textarea"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Textarea</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter longer text..." rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="select"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Select</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="opt1">Option 1</SelectItem>
                      <SelectItem value="opt2">Option 2</SelectItem>
                      <SelectItem value="opt3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="radio"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Radio Group</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col gap-2"
                    >
                      {(["option1", "option2", "option3"] as const).map(opt => (
                        <div key={opt} className="flex items-center gap-2">
                          <RadioGroupItem value={opt} id={opt} />
                          <Label htmlFor={opt} className="cursor-pointer capitalize">
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
            <FormField
              control={form.control}
              name="checkbox"
              render={({ field }: any) => (
                <FormItem className="flex items-start gap-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} id="checkbox" />
                  </FormControl>
                  <div>
                    <FormLabel htmlFor="checkbox" className="cursor-pointer">
                      Checkbox
                    </FormLabel>
                    <FormDescription>Accept terms and conditions</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="toggle"
              render={({ field }: any) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel>Switch / Toggle</FormLabel>
                    <FormDescription>Enable or disable feature</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slider"
              render={({ field }: any) => (
                <FormItem>
                  <FormLabel>Slider — {field.value}%</FormLabel>
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
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => form.reset()}>
                Reset
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Submit Form
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  )
}
