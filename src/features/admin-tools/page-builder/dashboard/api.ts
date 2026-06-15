/**
 * Client-side API for the Page Builder dashboard (list / create / fetch /
 * delete). Mirrors `widget-builder/dashboard/api.ts`.
 *
 * `PageSummary` is re-declared here (NOT imported from `../server/storage`)
 * so this client module never pulls the fs-backed server store — and its
 * `node:fs` imports — into the browser bundle. The shape is kept in lockstep
 * with the server `PageSummary`; a drift surfaces at the call sites that read
 * these fields.
 */

import type { PageSchema } from "../schema/page-schema"
import { API_ROUTES } from "@/shared/api/routes"

export interface PageSummary {
  id: string
  title: { en: string; ar: string }
  permission: string
  layout: string
  blockCount: number
  navigation?: {
    enabled: boolean
    group: string
    icon: string
    order: number
    href?: string
  }
  updatedAt?: string
}

export async function listPages(): Promise<PageSummary[]> {
  const res = await fetch(API_ROUTES.pageBuilder.list, { cache: "no-store", credentials: "include" })
  if (!res.ok) throw new Error(`List failed (${res.status})`)
  const data = (await res.json()) as { pages: PageSummary[] }
  return data.pages
}

export async function fetchPage(pageId: string): Promise<PageSchema> {
  const res = await fetch(API_ROUTES.pageBuilder.item(pageId), { cache: "no-store", credentials: "include" })
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
  const data = (await res.json()) as { page: PageSchema }
  return data.page
}

export async function createPage(schema: PageSchema): Promise<PageSchema> {
  const res = await fetch(API_ROUTES.pageBuilder.list, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(schema),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Create failed (${res.status})`)
  }
  const data = (await res.json()) as { page: PageSchema }
  return data.page
}

export async function deletePage(pageId: string): Promise<void> {
  const res = await fetch(API_ROUTES.pageBuilder.item(pageId), { method: "DELETE", credentials: "include" })
  if (!res.ok) throw new Error(`Delete failed (${res.status}): ${await res.text()}`)
}
