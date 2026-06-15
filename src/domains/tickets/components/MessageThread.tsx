"use client"
// Calls client-only hooks or imports a client-only package
// (recharts, framer-motion, cmdk, etc.). Required to be a
// Client Component — enforced by scripts/check-rsc-boundaries.mjs.

/**
 * Message Thread - Modern, Optimized Design
 */

import { useRef, useEffect, useMemo } from "react"
import { Loader2, MessageSquare } from "lucide-react"
import { useT } from "@/shared/config"
import type { TicketMessage } from "../types"
import { MessageBubble } from "./MessageBubble"

interface MessageThreadProps {
  messages: TicketMessage[]
  currentUserId: string
  isLoading?: boolean
  onUpdateMessage?: (id: string, text: string) => void
}

export function MessageThread({ messages, currentUserId, isLoading, onUpdateMessage }: MessageThreadProps) {
  const t = useT()
  const endRef = useRef<HTMLDivElement>(null)

  const dateLabels = useMemo(() => {
    const now = new Date()
    return {
      today: now.toLocaleDateString(),
      yesterday: new Date(now.getTime() - 86400000).toLocaleDateString(),
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("pages_tickets.tickets.detail.loading_messages")}</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-sm">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-lg">{t("pages_tickets.tickets.detail.no_messages")}</p>
            <p className="text-sm text-muted-foreground">{t("pages_tickets.tickets.detail.empty_state_description")}</p>
          </div>
        </div>
      </div>
    )
  }

  const getSeparator = (m: TicketMessage, prev?: TicketMessage) => {
    const date = new Date(m.creationTime || m.date)
    const dStr = date.toLocaleDateString()
    if (!prev) return dStr
    const prevDate = new Date(prev.creationTime || prev.date)
    if (prevDate.toLocaleDateString() !== dStr) return dStr
    return null
  }

  const formatSeparator = (dStr: string) => {
    if (dStr === dateLabels.today) return "Today"
    if (dStr === dateLabels.yesterday) return "Yesterday"

    const date = new Date(dStr)
    return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
      {messages.map((message, index) => {
        if (!message) return null

        const prevMessage = messages[index - 1]
        const separator = getSeparator(message, prevMessage)
        const getSenderId = (m: TicketMessage) => m.userInfo?.id || m.creatorId || "unknown"
        const showAvatar = !prevMessage || getSenderId(prevMessage) !== getSenderId(message) || !!separator

        return (
          <div key={message.id} className="space-y-4">
            {separator && (
              <div className="flex justify-center py-6">
                <span className="px-4 py-1.5 rounded-full bg-muted border border-border text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {formatSeparator(separator)}
                </span>
              </div>
            )}
            <MessageBubble
              message={message}
              isOwn={message.userInfo?.id === currentUserId || message.creatorId === currentUserId}
              showAvatar={showAvatar}
              onUpdate={onUpdateMessage}
            />
          </div>
        )
      })}
      <div ref={endRef} className="h-4" />
    </div>
  )
}
