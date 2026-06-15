"use client"

/**
 * Action executor — turns a Page Builder `actionSchema` value into a real
 * runtime side-effect. Per spec §3 + §7 actions support four kinds:
 *
 *   - `api`      : HTTP call through `apiClient` (never raw `fetch`)
 *   - `navigate` : client-side route change via Next.js router
 *   - `dialog`   : open a modal dialog hosting nested blocks
 *   - `drawer`   : open a side-sheet hosting nested blocks
 *
 * The hook shape (`useActionExecutor`) is required because every effect
 * routes through React-context-bound utilities — useNotification, useT,
 * useRouter, useOverlayHost. A plain non-hook export would force every
 * caller to thread those through props, defeating the point.
 *
 * Returns a single async `execute(action, context)`:
 *   - `context.row`      : row data for row-action interpolation (e.g. `{id}`)
 *   - `context.entityId` : top-level entity id when the page is detail-bound
 *   - `context.params`   : free-form key/value bag for arbitrary tokens
 *
 * The hook auto-injects `overlayHost` and `renderBlocks` into the context
 * passed to `executeAction`, so callers don't see them in the surface
 * API. The fields exist on `ExecuteContext` purely to make the dialog /
 * drawer dispatch testable in isolation (mock the host, assert the
 * shape of what reached it).
 *
 * Interpolation is done by `applyInterpolation`. The template syntax matches
 * the spec: `/{id}/close` → resolves `id` from context.row.id (or
 * context.entityId, or context.params.id, in that order). Unknown tokens
 * are left unresolved + a warning is reported via errorReporter so a
 * misconfigured schema fails loudly rather than silently calling the wrong
 * URL.
 */

import { useCallback } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/shared/config"
import { useNotification } from "@/ui/application/hooks/useNotification"
import { useOverlayHost } from "@/ui/application/hooks/useOverlayHost"
import type { OverlayHostContextValue } from "@/ui/application/contexts/OverlayHostContext"
import { errorReporter } from "@/infra/observability/error-reporter"
import { runPageBuilderApiRequest } from "./page-builder-action.service"
import { renderBlocks as defaultRenderBlocks } from "./render-blocks"
import type { ActionSchema } from "../schema/action-schema"
import type { BlockSchema } from "../schema/block-schema"

export interface ExecuteContext {
  /** Data for the current row (for table row-actions). */
  row?: Record<string, unknown>
  /** Top-level entity id (for detail pages). */
  entityId?: string | number
  /** Arbitrary additional bindings for `{token}` interpolation. */
  params?: Record<string, string | number>
  /**
   * Overlay host for `dialog` / `drawer` actions. Auto-injected by
   * `useActionExecutor`; tests may pass a mock to assert the host call.
   */
  overlayHost?: OverlayHostContextValue
  /**
   * Render a `BlockSchema[]` to a ReactNode the overlay host can mount.
   * Auto-injected by `useActionExecutor`; tests may pass a mock to make
   * the dispatch observable without rendering BlockRenderer.
   */
  renderBlocks?: (blocks: BlockSchema[]) => ReactNode
}

/**
 * Replace `{token}` occurrences with values from the context. Tokens
 * resolve in priority order: params → row → entityId (for the special
 * `{id}` and `{entityId}` keys). Unknown tokens leave the brace literal
 * AND emit a structured error report so the misconfiguration is visible.
 */
export function applyInterpolation(template: string, context: ExecuteContext): string {
  return template.replace(/\{(\w+)\}/g, (match, token: string) => {
    const fromParams = context.params?.[token]
    if (fromParams !== undefined) return String(fromParams)
    const fromRow = context.row?.[token]
    if (fromRow !== undefined && fromRow !== null) return String(fromRow)
    if ((token === "id" || token === "entityId") && context.entityId !== undefined) {
      return String(context.entityId)
    }
    errorReporter.captureException(new Error(`Unknown interpolation token "${token}"`), {
      tags: { source: "page-builder.action-executor" },
      extra: { template, token },
    })
    return match
  })
}

type ApiAction = Extract<ActionSchema, { type: "api" }>
type DialogAction = Extract<ActionSchema, { type: "dialog" }>
type DrawerAction = Extract<ActionSchema, { type: "drawer" }>

async function runApiAction(
  action: ApiAction,
  context: ExecuteContext,
  router: ReturnType<typeof useRouter>,
  notify: ReturnType<typeof useNotification>,
  t: (key: string, params?: Record<string, string>) => string,
): Promise<void> {
  const url = applyInterpolation(action.endpoint, context)
  try {
    const body = action.body ? JSON.parse(applyInterpolation(JSON.stringify(action.body), context)) : undefined
    await runPageBuilderApiRequest({ url, method: action.method, data: body })
    if (action.onSuccess?.notify) {
      const msg = action.onSuccess.notify.en
      notify.success(msg.includes(".") ? msg : msg)
    }
    if (action.onSuccess?.navigate) {
      router.push(applyInterpolation(action.onSuccess.navigate, context))
    }
    // `refresh` is honoured by Next.js router; pages that opted in re-fetch.
    if (action.onSuccess?.refresh ?? true) router.refresh()
  } catch (err) {
    errorReporter.captureException(err, {
      tags: { source: "page-builder.action-executor", method: action.method, url },
    })
    notify.error(action.onError?.notify?.en ?? (err instanceof Error ? err.message : t("errors.unknown")))
  }
}

/**
 * Resolve the overlay host + renderer pair from the context, with a
 * structured error if either is missing. Either being undefined means a
 * caller built the context by hand and forgot the auto-injected fields —
 * we fail loudly via errorReporter instead of crashing the user click.
 */
function resolveOverlayDeps(
  actionType: "dialog" | "drawer",
  context: ExecuteContext,
  notify: ReturnType<typeof useNotification>,
): { overlayHost: OverlayHostContextValue; renderBlocks: (blocks: BlockSchema[]) => ReactNode } | null {
  if (!context.overlayHost || !context.renderBlocks) {
    errorReporter.captureException(new Error(`'${actionType}' action requires overlayHost + renderBlocks in context`), {
      tags: { source: "page-builder.action-executor", actionType },
    })
    notify.error("admin.pageBuilder.actionNotSupported")
    return null
  }
  return { overlayHost: context.overlayHost, renderBlocks: context.renderBlocks }
}

function runDialogAction(
  action: DialogAction,
  context: ExecuteContext,
  notify: ReturnType<typeof useNotification>,
): void {
  const deps = resolveOverlayDeps("dialog", context, notify)
  if (!deps) return
  deps.overlayHost.openDialog({
    title: action.title.en,
    content: deps.renderBlocks(action.blocks),
  })
}

function runDrawerAction(
  action: DrawerAction,
  context: ExecuteContext,
  notify: ReturnType<typeof useNotification>,
): void {
  const deps = resolveOverlayDeps("drawer", context, notify)
  if (!deps) return
  deps.overlayHost.openDrawer({
    title: action.title.en,
    side: action.side,
    content: deps.renderBlocks(action.blocks),
  })
}

/**
 * Promise-based confirm. Phase 3 uses `window.confirm` for simplicity —
 * jsdom supports it (so tests can mock the prompt), and routing the
 * prompt through the overlay host adds an async confirmation layer the
 * action surface doesn't yet need.
 */
function promptConfirm(title: string, message: string): boolean {
  if (typeof window === "undefined") return true
  return window.confirm(`${title}\n\n${message}`)
}

export function useActionExecutor() {
  const router = useRouter()
  const notify = useNotification()
  const t = useT()
  const overlayHost = useOverlayHost()

  return useCallback(
    async (action: ActionSchema, baseContext: ExecuteContext = {}): Promise<void> => {
      // Auto-inject overlay-host plumbing. Callers retain the ability to
      // override (tests pass a mocked overlayHost / renderBlocks pair).
      const context: ExecuteContext = {
        ...baseContext,
        overlayHost: baseContext.overlayHost ?? overlayHost,
        renderBlocks: baseContext.renderBlocks ?? defaultRenderBlocks,
      }

      // Optional confirmation gate — supported on api actions per spec §7.
      if (action.type === "api" && action.confirm) {
        const confirmed = promptConfirm(action.confirm.title.en, action.confirm.message.en)
        if (!confirmed) return
      }

      switch (action.type) {
        case "api":
          await runApiAction(action, context, router, notify, t)
          return

        case "navigate":
          if (action.external) {
            if (typeof window !== "undefined") window.open(action.href, "_blank", "noopener,noreferrer")
            return
          }
          router.push(applyInterpolation(action.href, context))
          return

        case "dialog":
          runDialogAction(action, context, notify)
          return

        case "drawer":
          runDrawerAction(action, context, notify)
          return
      }
    },
    [router, notify, t, overlayHost],
  )
}
