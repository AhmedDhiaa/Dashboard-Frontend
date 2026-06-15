import { redirect } from "next/navigation"

/**
 * The 7-step EntityBuilderWizard was retired in favour of the runtime
 * `/builder` UI. This stub kept around so old bookmarks land somewhere
 * useful instead of 404ing.
 */
export default function Page() {
  redirect("/builder?tab=entities")
}
