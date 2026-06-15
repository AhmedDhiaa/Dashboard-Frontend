/**
 * Encapsulates all client-side state, validation, and submission logic for the
 * login form. The page component stays presentational.
 */

"use client"

import type React from "react"
import { useCallback, useState, type Dispatch, type SetStateAction } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { logger } from "@/shared/logger"
import { getSafePath } from "@/shared/utils/url"

interface LoginFieldErrors {
  username?: string
  password?: string
}

interface UseLoginFormResult {
  username: string
  password: string
  showPassword: boolean
  isLoading: boolean
  error: string
  fieldErrors: LoginFieldErrors
  setError: Dispatch<SetStateAction<string>>
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onTogglePassword: () => void
  onSubmit: (e: React.FormEvent) => Promise<void>
}

const NETWORK_HINTS = ["fetch", "network", "timed out", "econnrefused"] as const

function isNetworkErrorMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return NETWORK_HINTS.some(s => lower.includes(s))
}

function parseErrorCode(url?: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).searchParams.get("code")
  } catch {
    return null
  }
}

export function useLoginForm(t: (key: string) => string): UseLoginFormResult {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})

  const onUsernameChange = useCallback((value: string) => {
    setUsername(value)
    setFieldErrors(prev => ({ ...prev, username: undefined }))
  }, [])

  const onPasswordChange = useCallback((value: string) => {
    setPassword(value)
    setFieldErrors(prev => ({ ...prev, password: undefined }))
  }, [])

  const onTogglePassword = useCallback(() => setShowPassword(v => !v), [])

  const validate = useCallback((): boolean => {
    const errors: LoginFieldErrors = {}
    if (!username.trim()) errors.username = t("username_required")
    if (!password) errors.password = t("password_required")
    else if (password.length < 6) errors.password = t("password_min_length")
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [username, password, t])

  const onSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault()
      setError("")
      if (!validate()) return
      setIsLoading(true)

      try {
        const result = await signIn("credentials", {
          username: username.trim(),
          password,
          redirect: false,
        })

        if (result?.error) {
          const code = parseErrorCode(result.url)
          setError(code === "ServerError" ? t("errors.network_error") : t("invalid_credentials"))
          return
        }

        if (result?.ok) {
          const raw = searchParams.get("callbackUrl") || searchParams.get("redirectTo") || "/"
          router.push(getSafePath(raw))
          router.refresh()
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (isNetworkErrorMessage(message)) {
          setError(t("errors.network_error"))
        } else {
          logger.error("SignIn unexpected failure:", err)
          setError(t("unexpected_error"))
        }
      } finally {
        setIsLoading(false)
      }
    },
    [username, password, validate, router, searchParams, t],
  )

  return {
    username,
    password,
    showPassword,
    isLoading,
    error,
    fieldErrors,
    setError,
    onUsernameChange,
    onPasswordChange,
    onTogglePassword,
    onSubmit,
  }
}
