/**
 * CONFIRM DIALOG COMPONENT - DESIGN SYSTEM COMPLIANT
 *
 * Uses ONLY CSS variables from design tokens.
 * NO hardcoded dark mode classes.
 * Centralized confirmation dialog for operations with loading states.
 *
 * @strict @enterprise-grade
 */

"use client"

import { useT } from "@/shared/config"
import { Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/design-system/primitives/alert-dialog"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void | Promise<void>
  variant?: "default" | "destructive"
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  variant = "destructive",
  isLoading = false,
}: ConfirmDialogProps) {
  const t = useT("common")

  const finalTitle = title ?? t("deleteConfirmation")
  const finalDescription = description ?? t("cannotBeUndone")
  const finalConfirmText = confirmText ?? t("confirm")
  const finalCancelText = cancelText ?? t("cancel")

  const handleConfirm = async () => {
    await onConfirm()
  }

  // Prevent closing dialog during loading
  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{finalTitle}</AlertDialogTitle>
          <AlertDialogDescription>{finalDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{finalCancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={
              variant === "destructive"
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            }
          >
            {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {isLoading ? t("processing") : finalConfirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
