"use client"

/**
 * LayoutSection — page-chrome primitives.
 *
 * Covered: PageHeader (plain, with badge, with actions, with breadcrumbs)
 * and a fenced wireframe illustrating Header + Sidebar at reduced scale.
 * The real Sidebar and Header components depend on the dashboard's
 * permission / nav / locale contexts which a standalone showcase mount
 * doesn't bootstrap; the illustration here is structural only.
 */

import { Download, Plus } from "lucide-react"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Button } from "@/ui/design-system/primitives/button"
import { PageHeader } from "@/ui/layout/PageHeader"
import ShowcaseBlock from "../_shared/ShowcaseBlock"

export default function LayoutSection() {
  return (
    <div className="space-y-6">
      <PlainHeaderBlock />
      <BadgedHeaderBlock />
      <ActionHeaderBlock />
      <BreadcrumbHeaderBlock />
      <ChromeWireframeBlock />
    </div>
  )
}

function PlainHeaderBlock() {
  return (
    <ShowcaseBlock title="PageHeader — plain" description="Title + description only.">
      <PageHeader title="Orders" description="All customer orders, newest first." className="mb-0" />
    </ShowcaseBlock>
  )
}

function BadgedHeaderBlock() {
  return (
    <ShowcaseBlock title="PageHeader — with badge" description="Title with a status indicator badge.">
      <PageHeader
        title="Theme Customizer"
        description="Configure tokens, save presets."
        badge={<Badge variant="warning">Beta</Badge>}
        className="mb-0"
      />
    </ShowcaseBlock>
  )
}

function ActionHeaderBlock() {
  return (
    <ShowcaseBlock
      title="PageHeader — with actions"
      description="Primary + secondary action buttons on the inline-end."
    >
      <PageHeader
        title="Reports"
        description="Operational dashboards for fleet and finance."
        actions={
          <>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button>
              <Plus className="h-4 w-4" />
              New report
            </Button>
          </>
        }
        className="mb-0"
      />
    </ShowcaseBlock>
  )
}

function BreadcrumbHeaderBlock() {
  return (
    <ShowcaseBlock title="PageHeader — with breadcrumbs" description="Breadcrumb trail above the title.">
      <PageHeader
        title="ORD-100231"
        description="View and edit a single order."
        breadcrumbs={[
          { title: "Orders", href: "/orders" },
          { title: "ORD-100231", active: true },
        ]}
        className="mb-0"
      />
    </ShowcaseBlock>
  )
}

function ChromeWireframeBlock() {
  return (
    <ShowcaseBlock
      title="Header + Sidebar wireframe"
      description="Structural illustration only — the real components pull from permission / nav / locale contexts that this standalone showcase doesn't mount."
    >
      <div className="rounded-lg border-2 border-dashed border-border overflow-hidden bg-background">
        <div className="grid grid-cols-[10rem_1fr] min-h-64">
          <aside className="bg-muted/40 border-e border-border/60 p-3 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Sidebar</div>
            <div className="space-y-1">
              {["Dashboard", "Orders", "Customers", "Drivers", "Reports", "Settings"].map(label => (
                <div
                  key={label}
                  className="rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted cursor-default"
                >
                  {label}
                </div>
              ))}
            </div>
          </aside>
          <div>
            <header className="border-b border-border/60 px-4 py-3 flex items-center justify-between bg-card/40">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Header</div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-32 rounded-md bg-muted" />
                <div className="h-6 w-6 rounded-full bg-muted" />
              </div>
            </header>
            <main className="p-6 text-sm text-muted-foreground space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Content area</div>
              <div className="h-8 w-1/3 rounded bg-muted" />
              <div className="h-32 w-full rounded bg-muted/60" />
            </main>
          </div>
        </div>
      </div>
    </ShowcaseBlock>
  )
}
