/**
 * Thin client for the theme override endpoints. Routes resolved through
 * `API_ROUTES.theme` so renames stay a one-file change.
 */

import { API_ROUTES } from "@/shared/api/routes"

interface Stage {
  stage: "draft" | "live"
  tokens: Record<string, string>
  version: number
  updatedAt: string | null
  updatedBy: string | null
}

export async function fetchStage(stage: "draft" | "live"): Promise<Stage> {
  const url = stage === "draft" ? `${API_ROUTES.theme.overrides}?stage=draft` : API_ROUTES.theme.overrides
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`Failed to fetch theme ${stage} (${res.status})`)
  return (await res.json()) as Stage
}

export async function saveDraft(tokens: Record<string, string>): Promise<Stage> {
  const res = await fetch(API_ROUTES.theme.overrides, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokens }),
  })
  if (!res.ok) throw new Error(`PATCH failed (${res.status}): ${await res.text()}`)
  return (await res.json()) as Stage
}

export async function publishDraft(): Promise<Stage> {
  const res = await fetch(API_ROUTES.theme.publish, { method: "POST" })
  if (!res.ok) throw new Error(`Publish failed (${res.status}): ${await res.text()}`)
  return (await res.json()) as Stage
}

export async function revertDraft(): Promise<Stage> {
  const res = await fetch(API_ROUTES.theme.revert, { method: "POST" })
  if (!res.ok) throw new Error(`Revert failed (${res.status}): ${await res.text()}`)
  return (await res.json()) as Stage
}
