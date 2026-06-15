"use client"

/**
 * Registry-metadata controls that flow into the materialize POST body.
 *
 * Four controls, deliberately spartan: a Group select (from the existing
 * NAV_GROUPS titleKeys, passed in as a prop so this file doesn't import
 * navigation.ts and pull lucide-react via that path), a numeric Position,
 * an Icon select (curated 20-name list — see materialize-icons.ts), and
 * a Permission Key text input.
 *
 * Pure controlled component: the parent owns `value` + `onChange`. We
 * surface a `Reset to defaults` action that snaps every field back to
 * what `computeDefaults` returns for the entity — useful when an admin
 * mucks the form and wants a clean slate.
 *
 * No persistence in here — the parent dialog decides whether to save
 * the values back onto the runtime entity before materialize.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"
import { RotateCcw } from "lucide-react"
import { MATERIALIZE_ICONS, kebabToPascal } from "./materialize-icons"

export interface MaterializeSummaryValue {
  group: string
  order: number
  icon: string
  permissionKey: string
}

export interface MaterializeSummaryCardProps {
  value: MaterializeSummaryValue
  onChange: (next: MaterializeSummaryValue) => void
  /** Plural identifier (e.g. "brands"). Used in the default href hint text. */
  entityNamePlural: string
  /** Kebab id (e.g. "brand"). Used to compute the default permission key. */
  entityNameKebab: string
  /** NAV_GROUPS' titleKey list — passed in so this file doesn't need to
   *  import navigation.ts (which would pull all of lucide via that path). */
  navGroupOptions: readonly string[]
}

export function computeDefaults(entityNameKebab: string, navGroupOptions: readonly string[]): MaterializeSummaryValue {
  return {
    group: navGroupOptions[0] ?? "nav.master_data",
    order: 99,
    icon: "Box",
    permissionKey: `Api.${kebabToPascal(entityNameKebab)}`,
  }
}

export function MaterializeSummaryCard({
  value,
  onChange,
  entityNamePlural,
  entityNameKebab,
  navGroupOptions,
}: MaterializeSummaryCardProps): React.ReactNode {
  const set = <K extends keyof MaterializeSummaryValue>(k: K, v: MaterializeSummaryValue[K]) =>
    onChange({ ...value, [k]: v })

  const handleReset = () => onChange(computeDefaults(entityNameKebab, navGroupOptions))

  return (
    <Card className="border-info/30 bg-info/5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
        <CardTitle className="text-sm">Registry metadata</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-1 text-xs"
          data-testid="reset-defaults"
        >
          <RotateCcw className="h-3 w-3" />
          Reset to defaults
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0">
        <Field label="Sidebar group" htmlFor="ms-group">
          <Select value={value.group} onValueChange={v => set("group", v)}>
            <SelectTrigger id="ms-group">
              <SelectValue placeholder="Pick a group…" />
            </SelectTrigger>
            <SelectContent>
              {navGroupOptions.map(key => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Position" htmlFor="ms-order">
          <Input
            id="ms-order"
            type="number"
            min={0}
            value={String(value.order)}
            onChange={e => set("order", Number(e.target.value) || 0)}
          />
        </Field>

        <Field label="Sidebar icon" htmlFor="ms-icon">
          <Select value={value.icon} onValueChange={v => set("icon", v)}>
            <SelectTrigger id="ms-icon">
              <SelectValue placeholder="Pick an icon…" />
            </SelectTrigger>
            <SelectContent>
              {MATERIALIZE_ICONS.map(({ name, Icon }) => (
                <SelectItem key={name} value={name}>
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Permission key"
          htmlFor="ms-permission"
          hint="Only 3+ segment keys get registered automatically; 2-segment defaults (e.g. Api.Brand) are inline-only."
        >
          <Input
            id="ms-permission"
            value={value.permissionKey}
            onChange={e => set("permissionKey", e.target.value)}
            placeholder={`Api.${kebabToPascal(entityNameKebab)}`}
          />
        </Field>

        <p className="md:col-span-2 text-[11px] text-muted-foreground">
          Default href: <code className="font-mono">/{entityNamePlural}</code>
        </p>
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}): React.ReactNode {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
