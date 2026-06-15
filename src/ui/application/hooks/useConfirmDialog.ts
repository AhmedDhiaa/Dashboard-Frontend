/**
 * useConfirmDialog Hook
 *
 * Enhanced hook for confirmation dialogs with loading states and error handling
 */

import { useState } from "react"
import { logger } from "@/shared/logger"

export interface ConfirmDialogConfig {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [config, setConfig] = useState<ConfirmDialogConfig>({})
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void | Promise<void>) | null>(null)

  const showConfirm = (callback: () => void | Promise<void>, dialogConfig?: ConfirmDialogConfig) => {
    setConfig(dialogConfig || {})
    setOnConfirmCallback(() => callback)
    setIsOpen(true)
  }

  const handleConfirm = async () => {
    if (onConfirmCallback) {
      try {
        setIsLoading(true)
        await onConfirmCallback()
        // Only close on success
        setIsOpen(false)
      } catch (error) {
        // Keep dialog open on error - let the callback handle error notifications
        logger.error("Confirmation action failed:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return {
    isOpen,
    setIsOpen,
    isLoading,
    config,
    showConfirm,
    handleConfirm,
  }
}
