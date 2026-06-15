"use client"

/**
 * BuilderPage — the master Builder UI hosted at `/builder`. Tabs:
 *   Entities · Pages · Dashboards · System
 */

import { Database, LayoutDashboard, ListChecks, Settings, Wrench } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/design-system/primitives/tabs"
import { EntityList } from "./EntityList"
import { PageManager } from "./PageManager"
import { DashboardBuilder } from "./DashboardBuilder"
import { SystemPanel } from "./SystemPanel"

export function BuilderPage({ defaultTab = "entities" }: { defaultTab?: string }) {
  return (
    <div className="container py-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <Wrench className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Runtime Builder</h1>
          <p className="text-sm text-muted-foreground">
            Build entities, pages, and dashboards live — no backend required.
          </p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="entities" className="gap-2">
            <Database className="h-4 w-4" />
            Entities
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-2">
            <ListChecks className="h-4 w-4" />
            Pages
          </TabsTrigger>
          <TabsTrigger value="dashboards" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboards
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Settings className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entities">
          <EntityList />
        </TabsContent>
        <TabsContent value="pages">
          <PageManager />
        </TabsContent>
        <TabsContent value="dashboards">
          <DashboardBuilder />
        </TabsContent>
        <TabsContent value="system">
          <SystemPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
