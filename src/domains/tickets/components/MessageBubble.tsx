"use client"
// Calls client-only hooks or imports a client-only package
// (recharts, framer-motion, cmdk, etc.). Required to be a
// Client Component — enforced by scripts/check-rsc-boundaries.mjs.

import { useState, useEffect, useRef } from "react"
import { Avatar, AvatarFallback } from "@/ui/design-system/primitives/avatar"
import { cn } from "@/shared/utils"
import { Pencil, Check, X, Loader2 } from "lucide-react"
import type { TicketMessage } from "../types"
import { getAvatarColor, getInitials } from "@/shared/utils/avatar"
import { Button } from "@/ui/design-system/primitives/button"

interface MessageBubbleProps {
  message: TicketMessage
  isOwn: boolean
  showAvatar: boolean
  onUpdate?: (id: string, text: string) => void
}

// ... MessageAvatar and MessageTimestamp stay the same but moved inside for brevity if needed
// Actually I'll keep them as they are but ensure they are available.

function MessageAvatar({
  showAvatar,
  avatarColor,
  userName,
}: {
  showAvatar: boolean
  avatarColor: string
  userName: string
}) {
  if (!showAvatar) return <div className="w-9 shrink-0" />
  return (
    <Avatar className={cn("h-9 w-9 shrink-0 ring-2 ring-background shadow-sm", avatarColor)}>
      <AvatarFallback className="text-white text-xs font-bold">{getInitials(userName)}</AvatarFallback>
    </Avatar>
  )
}

function MessageTimestamp({ date, creationTime }: { date?: string; creationTime?: string }) {
  const dateString = date || creationTime
  if (!dateString) return null
  const time = new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return <span className="text-[10px] font-medium tabular-nums opacity-70">{time}</span>
}

function getSenderInfo(message: TicketMessage) {
  const ui = message.userInfo
  const entity = ui?.entity || message.creator
  const id = ui?.id || message.creatorId || "unknown"
  return { name: entity?.name || "Unknown", id }
}

interface EditModeProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  editText: string
  setEditText: (text: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onCancel: () => void
  onSave: () => void
  isSaving: boolean
}

function EditMode({ textareaRef, editText, setEditText, onKeyDown, onCancel, onSave, isSaving }: EditModeProps) {
  return (
    <div className="flex flex-col gap-2 min-w-[200px]">
      <textarea
        ref={textareaRef}
        value={editText}
        onChange={e => setEditText(e.target.value)}
        onKeyDown={onKeyDown}
        className="bg-transparent border-none focus:ring-0 text-sm resize-none p-0 w-full text-inherit placeholder:text-inherit/50"
        rows={Math.min(5, editText.split("\n").length || 1)}
      />
      <div className="flex justify-end gap-1 border-t border-primary-foreground/20 pt-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full hover:bg-primary-foreground/10"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full hover:bg-primary-foreground/10"
          onClick={onSave}
          disabled={isSaving || !editText.trim()}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  )
}

interface DisplayModeProps {
  text: string
  date?: string
  creationTime?: string
  isOwn: boolean
}

function DisplayMode({ text, date, creationTime, isOwn }: DisplayModeProps) {
  return (
    <>
      <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{text}</p>
      <div
        className={cn(
          "flex items-center gap-1 mt-1 justify-end opacity-70",
          isOwn ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        <MessageTimestamp date={date} creationTime={creationTime} />
        {isOwn && <span className="text-[10px] font-bold">✓</span>}
      </div>
    </>
  )
}

export function MessageBubble({ message, isOwn, showAvatar, onUpdate }: MessageBubbleProps) {
  const { name: userName, id: senderId } = getSenderInfo(message)
  const avatarColor = getAvatarColor(senderId)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.text)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length)
    }
  }, [isEditing])

  const handleSave = async () => {
    if (editText.trim() === message.text) return setIsEditing(false)
    if (!onUpdate) return setIsEditing(false)
    setIsSaving(true)
    try {
      await onUpdate(message.id, editText)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === "Escape") {
      setIsEditing(false)
      setEditText(message.text)
    }
  }

  return (
    <div
      className={cn(
        "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
        isOwn ? "justify-end" : "justify-start",
      )}
    >
      <div className={cn("flex gap-3 items-end max-w-[85%] group/row", isOwn && "flex-row-reverse")}>
        <div className="w-9 shrink-0">
          <MessageAvatar showAvatar={showAvatar} avatarColor={avatarColor} userName={userName} />
        </div>
        <div className={cn("flex flex-col gap-1 min-w-0", isOwn && "items-end")}>
          {showAvatar && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-3 mb-0.5">
              {userName}
            </span>
          )}
          <div className="relative group/bubble flex items-center gap-2">
            {isOwn && !isEditing && (
              <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-muted"
                  onClick={() => {
                    setEditText(message.text)
                    setIsEditing(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
            <div
              className={cn(
                "relative rounded-2xl px-4 py-2.5 transition-colors duration-200",
                isOwn
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-card border border-border text-foreground rounded-bl-none",
              )}
            >
              {isEditing ? (
                <EditMode
                  textareaRef={textareaRef}
                  editText={editText}
                  setEditText={setEditText}
                  onKeyDown={handleKeyDown}
                  onCancel={() => setIsEditing(false)}
                  onSave={handleSave}
                  isSaving={isSaving}
                />
              ) : (
                <DisplayMode
                  text={message.text}
                  date={message.date}
                  creationTime={message.creationTime}
                  isOwn={isOwn}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
