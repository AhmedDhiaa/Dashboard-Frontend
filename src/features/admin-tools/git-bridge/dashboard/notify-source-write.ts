/**
 * Shared "source-write success" toast — one shape, every save flow.
 *
 * The intent is admin muscle memory: every time a save touches source
 * files, the admin sees the same line + the same call-to-action. Six
 * flows fire this helper:
 *
 *   1. Translation editor save (useOverrideMutations.saveEdit)
 *   2. Runtime-builder upsertEntity (entity-builder UI)
 *   3. Page-builder useSavePage success
 *   4. Page-builder useMaterializePage success
 *   5. Runtime materialize SuccessBody
 *   6. Convert action success (EditFieldsButton)
 *
 * Fallback rationale: useNotification's surface is the basic toast
 * primitives (success/error/info/warning/promise). It has NO support
 * for action buttons, and react-hot-toast is lint-blocked outside the
 * useNotification wrapper. Per Part 3.3's spec, the documented fallback
 * is "use notifications.success(title) and append the /admin/git hint
 * to the body text" — which is what this helper does. The `router`
 * parameter is kept in the signature so a future upgrade (custom-toast
 * support in useNotification) can wire a real button without changing
 * every call site.
 *
 * The toast is FIRE-AND-FORGET — no return value, no error path. Any
 * failure (toast renderer crash, etc.) is the toast library's problem.
 */

import type { useNotification } from "@/ui/application"
import type { useRouter } from "next/navigation"

export type NotifySourceWriteNotifier = ReturnType<typeof useNotification>
export type NotifySourceWriteRouter = ReturnType<typeof useRouter> | undefined

/** Compose the toast message body. Exported for tests + assertion reuse.
 *
 * Deliberately slash-free: `useNotification.success` runs every string
 * through `t()` which heuristically treats dot-containing strings as
 * translation keys. A literal `/admin/git` in the body trips that
 * heuristic and produces console warnings under next-intl. The text-only
 * hint is good enough — the Git Bridge link is a known fixture in the
 * sidebar; the admin doesn't need a clickable href to find it. */
export function buildSourceWriteMessage(fileCount: number, _withRouter: boolean): string {
  const safe = Math.max(1, Math.trunc(fileCount))
  const noun = safe === 1 ? "file" : "files"
  return `Wrote ${safe} ${noun} - review in Git Bridge before committing`
}

export function notifySourceWrite(
  notifications: NotifySourceWriteNotifier,
  fileCount: number,
  router: NotifySourceWriteRouter,
): void {
  const message = buildSourceWriteMessage(fileCount, router !== undefined)
  notifications.success(message, undefined, { duration: 6000 })
  // `router` is currently unused — see file header for why. We touch the
  // reference so the linter doesn't strip the parameter from the public
  // signature; future custom-toast support will turn this into the real
  // onClick handler.
  void router
}
