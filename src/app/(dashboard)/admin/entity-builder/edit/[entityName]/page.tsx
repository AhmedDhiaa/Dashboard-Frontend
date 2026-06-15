import { redirect } from "next/navigation"

/**
 * The 7-step EntityBuilderWizard was retired in favour of the runtime
 * `/builder` UI. The old wizard's drafts are no longer editable from a
 * dedicated route — admins manage entities directly from the runtime
 * builder, where the same data lives as a `RuntimeEntity` and can be
 * materialised back to source files when ready.
 */
export default function Page() {
  redirect("/builder?tab=entities")
}
