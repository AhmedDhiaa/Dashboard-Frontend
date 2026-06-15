/**
 * Unified Notification Hook
 *
 * Centralized, i18n-aware toast notifications
 * Replaces direct react-hot-toast imports across the codebase
 *
 * @example
 * ```tsx
 * const notifications = useNotification();
 * notifications.success('common.messages.successCreate');
 * notifications.error(error);
 * notifications.confirm('common.messages.confirmDelete').then(confirmed => {...});
 * ```
 */

"use client"

import { useT } from "@/shared/config"

// eslint-disable-next-line no-restricted-imports -- This is the wrapper module that encapsulates the toast engine (sonner)
import { toast } from "sonner"
import { AppError } from "@/shared/types/errors"
import { getErrorMessage, extractApiErrorParts } from "@/shared/utils/error"
import { useCallback, useMemo } from "react"

export interface NotificationOptions {
  /** Duration in milliseconds */
  duration?: number
  /** Position on screen */
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
}

export interface UseNotificationReturn {
  /** Show success toast with i18n key */
  success: (key: string, params?: Record<string, string>, options?: NotificationOptions) => void
  /** Show error toast - handles Error objects and i18n keys */
  error: (error: AppError | Error | unknown | string, options?: NotificationOptions) => void
  /** Show info toast with i18n key */
  info: (key: string, params?: Record<string, string>, options?: NotificationOptions) => void
  /** Show warning toast with i18n key */
  warning: (key: string, params?: Record<string, string>, options?: NotificationOptions) => void
  /** Show loading toast */
  loading: (key: string, params?: Record<string, string>) => string
  /** Dismiss a toast by ID */
  dismiss: (toastId?: string) => void
  /**
   * Toast with an Undo action. `onCommit` runs when the toast times out without
   * the user undoing (the deferred action actually happens); `onUndo` runs when
   * the Undo button is clicked (cancel). Used for optimistic delete-with-undo.
   */
  undo: (
    key: string,
    options: { onUndo: () => void; onCommit: () => void; params?: Record<string, string>; duration?: number },
  ) => void
  /** Promise-based toast */
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: unknown) => string)
    },
    options?: NotificationOptions,
  ) => Promise<T>
}

/**
 * Get message from string with translation key detection
 */
function getStringMessage(error: string, t: (key: string) => string): string {
  const isTranslationKey = error.includes(".") && !error.startsWith("[") && !error.startsWith("{")
  return isTranslationKey ? t(error) : getErrorMessage(error)
}

/**
 * Resolve an error into a toast title + optional description.
 *
 * Prefers the API's own content — ABP `error.message` (title) and
 * `error.details` / `validationErrors` (description, joined with ·) — so the
 * backend's actual localized message surfaces. Falls back to a localized
 * default (`errors.network` for connectivity, else `errors.generic`) only when
 * the response carried nothing usable. Replaces the old `getValidationMessage`
 * which mis-treated the ABP error object as a flat ModelState map.
 */
function resolveErrorDisplay(
  error: AppError | Error | unknown | string,
  t: (key: string) => string,
): { message: string; description?: string } {
  const fallback = t("errors.generic")

  if (typeof error === "string") {
    return { message: getStringMessage(error, t) || fallback }
  }
  if (error instanceof AppError) {
    if (error.code === "NETWORK_ERROR") return { message: t("errors.network") }
    const { message, detail } = extractApiErrorParts(error.details)
    const title = message || (error.code.includes(".") ? t(error.code) : getErrorMessage(error)) || fallback
    return { message: title, description: detail }
  }
  if (error instanceof Error) {
    return { message: getErrorMessage(error) || fallback }
  }
  const extracted = getErrorMessage(error)
  return { message: extracted && extracted !== "An unknown error occurred" ? extracted : fallback }
}

// eslint-disable-next-line max-lines-per-function
export function useNotification(): UseNotificationReturn {
  const t = useT()

  const success = useCallback(
    (key: string, params?: Record<string, string>, options?: NotificationOptions) => {
      const message = t(key, params)
      toast.success(message, {
        duration: options?.duration ?? 5000,
        position: options?.position ?? "top-right",
      })
    },
    [t],
  )

  const error = useCallback(
    (error: AppError | Error | unknown | string, options?: NotificationOptions) => {
      const { message, description } = resolveErrorDisplay(error, t)
      toast.error(message, {
        description,
        duration: options?.duration ?? 6000,
        position: options?.position ?? "top-right",
      })
    },
    [t],
  )

  const info = useCallback(
    (key: string, params?: Record<string, string>, options?: NotificationOptions) => {
      const message = t(key, params)
      toast(message, {
        duration: options?.duration ?? 5000,
        position: options?.position ?? "top-right",
      })
    },
    [t],
  )

  const warning = useCallback(
    (key: string, params?: Record<string, string>, options?: NotificationOptions) => {
      const message = t(key, params)
      toast(message, {
        duration: options?.duration ?? 5000,
        position: options?.position ?? "top-right",
        icon: "⚠️",
      })
    },
    [t],
  )

  const loading = useCallback(
    (key: string, params?: Record<string, string>) => {
      const message = t(key, params)
      // Control the id so callers can dismiss the exact toast — sonner ids are
      // numeric by default, which would break the string `dismiss(id)` contract.
      const id = `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      toast.loading(message, { id, position: "top-right" })
      return id
    },
    [t],
  )

  const dismiss = useCallback((toastId?: string) => {
    toast.dismiss(toastId)
  }, [])

  const undo = useCallback(
    (
      key: string,
      {
        onUndo,
        onCommit,
        params,
        duration = 5000,
      }: { onUndo: () => void; onCommit: () => void; params?: Record<string, string>; duration?: number },
    ) => {
      const message = t(key, params)
      // `acted` guards against onCommit firing after the user already undid.
      let acted = false
      toast(message, {
        duration,
        position: "top-right",
        action: {
          label: t("common.undo"),
          onClick: () => {
            acted = true
            onUndo()
          },
        },
        onAutoClose: () => {
          if (!acted) onCommit()
        },
      })
    },
    [t],
  )

  const promiseToast = useCallback(
    <T>(
      promise: Promise<T>,
      messages: {
        loading: string
        success: string | ((data: T) => string)
        error: string | ((error: unknown) => string)
      },
      options?: NotificationOptions,
    ) => {
      toast.promise(promise, {
        loading: t(messages.loading),
        success: (data: T) => {
          const msg = typeof messages.success === "function" ? messages.success(data) : messages.success
          return msg.includes(".") ? t(msg) : msg
        },
        error: (err: unknown) => {
          const msg = typeof messages.error === "function" ? messages.error(err) : messages.error
          return msg.includes(".") ? t(msg) : msg
        },
        position: options?.position ?? "top-right",
        ...(options?.duration ? { duration: options.duration } : {}),
      })
      // Return the original promise so callers can still await the resolved
      // value — sonner's toast.promise returns a toast id, not the promise.
      return promise
    },
    [t],
  )

  return useMemo(
    () => ({
      success,
      error,
      info,
      warning,
      loading,
      dismiss,
      undo,
      promise: promiseToast,
    }),
    [success, error, info, warning, loading, dismiss, undo, promiseToast],
  )
}
