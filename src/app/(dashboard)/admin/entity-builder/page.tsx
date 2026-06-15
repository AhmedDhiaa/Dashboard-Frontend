/**
 * /admin/entity-builder — superseded by /admin/entities in Part 2.
 *
 * Kept as a permanent redirect so any bookmarks / docs that point at the
 * old URL keep working. The legacy dashboard (BackupsPanel + drafts
 * table) was moved to /admin/entities; the wizard was retired before
 * that. There is no longer any UI to host here.
 */

import { redirect } from "next/navigation"

export default function Page(): never {
  redirect("/admin/entities")
}
