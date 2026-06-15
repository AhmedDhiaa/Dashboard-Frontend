import type { WidgetBuilderSchema } from "../types/widget-schema"
import { API_ROUTES } from "@/shared/api/routes"

export interface WidgetSummary {
  id: string
  titleKey: string
  category: string
  permissionKey: string
  source: string
}

export async function listWidgets(): Promise<WidgetSummary[]> {
  const res = await fetch(API_ROUTES.widgetBuilder.list, { cache: "no-store" })
  if (!res.ok) throw new Error(`List failed (${res.status})`)
  const data = (await res.json()) as { widgets: WidgetSummary[] }
  return data.widgets
}

export async function fetchWidget(id: string): Promise<WidgetBuilderSchema> {
  const res = await fetch(API_ROUTES.widgetBuilder.item(id), { cache: "no-store" })
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
  const data = (await res.json()) as { widget: WidgetBuilderSchema }
  return data.widget
}

export async function deleteWidget(id: string): Promise<void> {
  const res = await fetch(API_ROUTES.widgetBuilder.item(id), { method: "DELETE" })
  if (!res.ok) throw new Error(`Delete failed (${res.status}): ${await res.text()}`)
}
