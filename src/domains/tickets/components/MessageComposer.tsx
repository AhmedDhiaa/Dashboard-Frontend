"use client"
// Calls client-only hooks or imports a client-only package
// (recharts, framer-motion, cmdk, etc.). Required to be a
// Client Component — enforced by scripts/check-rsc-boundaries.mjs.

/**
 * Message Composer - Modern, Enhanced Design
 */

import { useState, FormEvent } from "react"
import { logger } from "@/shared/logger"
import { Send, Loader2 } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Textarea } from "@/ui/design-system/primitives/textarea"
import { useT } from "@/shared/config"

interface MessageComposerProps {
  onSend: (text: string, note?: string) => Promise<void>
  disabled?: boolean
  placeholder?: string
}

export function MessageComposer({ onSend, disabled, placeholder }: MessageComposerProps) {
  const t = useT("pages_tickets")
  const [text, setText] = useState("")
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedText = text.trim()
    if (!trimmedText || disabled || isSending) return

    try {
      setIsSending(true)
      await onSend(trimmedText)
      setText("")
    } catch (error) {
      logger.error("Failed to send message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as FormEvent)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card p-4">
      <div className="flex gap-3 items-end max-w-5xl mx-auto">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t("tickets.detail.type_message")}
          disabled={disabled || isSending}
          className="min-h-[56px] max-h-[200px] resize-none"
          rows={1}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!text.trim() || disabled || isSending}
          size="icon"
          aria-label={t("tickets.detail.send")}
          className="h-[56px] w-[56px] shrink-0 rounded-xl"
        >
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 rtl:rotate-180" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        {t("tickets.detail.send_hint_prefix")}{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Enter</kbd>{" "}
        {t("tickets.detail.send_hint_middle")}{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{t("tickets.detail.send_shortcut_hint")}</kbd>{" "}
        {t("tickets.detail.send_hint_suffix")}
      </p>
    </form>
  )
}
