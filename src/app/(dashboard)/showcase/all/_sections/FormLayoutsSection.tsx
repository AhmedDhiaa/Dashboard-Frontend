"use client"

/**
 * FormLayoutsSection — the four config-driven form layout strategies an entity
 * config can pick from: Grid, Tabs, Sectioned, Split. Shown with plain inputs
 * as children (the layouts are presentational wrappers; in a real form the
 * children are FormField-bound inputs driven by the entity schema).
 */

import { User, MapPin, CreditCard } from "lucide-react"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { FormGridLayout } from "@/core/crud/components/FormGridLayout"
import { FormTabsLayout } from "@/core/crud/components/FormTabsLayout"
import { SectionedFormLayout } from "@/core/crud/components/SectionedFormLayout"
import { SplitFormLayout } from "@/core/crud/components/SplitFormLayout"
import ShowcaseBlock from "../_shared/ShowcaseBlock"

function Field({ label, placeholder }: { label: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input placeholder={placeholder ?? label} />
    </div>
  )
}

export default function FormLayoutsSection() {
  return (
    <div className="space-y-8">
      <ShowcaseBlock title="Grid layout" description="FormGridLayout — responsive N-column grid (the default).">
        <FormGridLayout columns={2}>
          <Field label="First name" />
          <Field label="Last name" />
          <Field label="Email" />
          <Field label="Phone" />
        </FormGridLayout>
      </ShowcaseBlock>

      <ShowcaseBlock title="Tabs layout" description="FormTabsLayout — fields grouped into tabbed panels.">
        <FormTabsLayout
          tabs={[
            {
              id: "profile",
              title: "Profile",
              icon: User,
              children: (
                <FormGridLayout columns={2}>
                  <Field label="First name" />
                  <Field label="Last name" />
                </FormGridLayout>
              ),
            },
            {
              id: "address",
              title: "Address",
              icon: MapPin,
              children: (
                <FormGridLayout columns={2}>
                  <Field label="City" />
                  <Field label="Street" />
                </FormGridLayout>
              ),
            },
            {
              id: "billing",
              title: "Billing",
              icon: CreditCard,
              children: (
                <FormGridLayout columns={2}>
                  <Field label="Card holder" />
                  <Field label="IBAN" />
                </FormGridLayout>
              ),
            },
          ]}
        />
      </ShowcaseBlock>

      <ShowcaseBlock title="Sectioned layout" description="SectionedFormLayout — titled (optionally collapsible) card sections.">
        <SectionedFormLayout
          sections={[
            {
              id: "identity",
              title: "Identity",
              icon: User,
              columns: 2,
              children: (
                <>
                  <Field label="First name" />
                  <Field label="Last name" />
                </>
              ),
            },
            {
              id: "location",
              title: "Location",
              description: "Where the record lives.",
              icon: MapPin,
              columns: 2,
              collapsible: true,
              defaultOpen: true,
              children: (
                <>
                  <Field label="City" />
                  <Field label="Area" />
                </>
              ),
            },
          ]}
        />
      </ShowcaseBlock>

      <ShowcaseBlock title="Split layout" description="SplitFormLayout — a form column beside a live preview/aside.">
        <SplitFormLayout
          leftContent={
            <FormGridLayout columns={1}>
              <Field label="Display name" />
              <Field label="Slug" />
            </FormGridLayout>
          }
          rightContent={
            <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
              Live preview / summary aside
            </div>
          }
        />
      </ShowcaseBlock>
    </div>
  )
}
