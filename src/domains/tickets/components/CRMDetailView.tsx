/**
 * CRM Detail View - Modern, Custom Design
 */

"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, User as UserIcon, Calendar, Hash, MessageSquare } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { useT } from "@/shared/config"
import { useEnumName } from "@/core/enums"
import { ConnectionStatus } from "./ConnectionStatus"
import { MessageThread } from "./MessageThread"
import { MessageComposer } from "./MessageComposer"
import { Avatar, AvatarFallback } from "@/ui/design-system/primitives/avatar"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Separator } from "@/ui/design-system/primitives/separator"
import { getAvatarColor, getInitials } from "@/shared/utils/avatar"
import { cn } from "@/shared/utils"
import type { Ticket, TicketMessage, BusinessPartner } from "@/domains/tickets/types"
import { useTicketDetail } from "../hooks/useTicketDetail"

function LoadingState() {
  const t = useT()
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-card border border-border shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          {t("pages_tickets.tickets.detail.loading_conversation")}
        </p>
      </div>
    </div>
  )
}

function ErrorState({ error, onBack, t }: { error: string; onBack: () => void; t: (key: string) => string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <MessageSquare className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{t("pages_tickets.tickets.detail.not_found")}</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={onBack} variant="primary" className="mt-4">
          <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
          {t("pages_tickets.tickets.detail.back_to_tickets")}
        </Button>
      </div>
    </div>
  )
}

function CustomerCard({ customer, avatarColor }: { customer: BusinessPartner | undefined; avatarColor: string }) {
  const t = useT()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <UserIcon className="h-3.5 w-3.5" />
        {t("pages_tickets.tickets.detail.customer")}
      </div>
      <div className="p-4 rounded-xl bg-card border border-border transition-colors duration-200 hover:border-foreground/15 group cursor-default">
        <div className="flex items-start gap-4">
          <Avatar className={cn("h-14 w-14 ring-2 ring-background", avatarColor)}>
            <AvatarFallback className="text-white font-semibold text-lg">
              {getInitials(customer?.name || "C")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1 mt-0.5">
            <p className="font-semibold text-base truncate">
              {customer?.name || t("pages_tickets.tickets.detail.unknown")}
            </p>
            <p className="text-xs font-medium text-muted-foreground truncate flex items-center gap-1.5">
              <Hash className="h-3 w-3" />
              {customer?.code || t("pages_tickets.tickets.detail.no_code")}
            </p>
            {customer?.phoneInfo?.number && (
              <p className="text-xs font-medium text-muted-foreground font-mono tabular-nums mt-1 border border-border p-1 px-2 rounded-md bg-muted/40 w-fit">
                {customer.phoneInfo.countryCode} {customer.phoneInfo.number}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusSection({ status, label }: { status: number; label: string }) {
  const statusVariants: Record<number, "info" | "warning" | "success" | "muted" | "destructive"> = {
    0: "info",
    1: "warning",
    2: "success",
    3: "muted",
    4: "destructive",
  }
  const variant = statusVariants[status] || "default"
  const t = useT()

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="h-2 w-2 rounded-full bg-current" />
        {t("pages_tickets.tickets.detail.status")}
      </div>
      <Badge variant={variant} className="w-full justify-center py-2.5 rounded-lg text-sm font-medium gap-2">
        <div className="h-2 w-2 rounded-full bg-current" />
        {label}
      </Badge>
    </div>
  )
}

function TicketDetailsGrid({ ticket }: { ticket: Ticket }) {
  const t = useT()
  const tStr = (date: string) => new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const dStr = (date: string) => new Date(date).toLocaleDateString()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Hash className="h-3.5 w-3.5" />
        {t("pages_tickets.tickets.detail.details")}
      </div>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground mb-1">{t("pages_tickets.tickets.detail.reference")}</p>
          <p className="text-sm font-mono font-semibold">{ticket.reference}</p>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground mb-1">{t("pages_tickets.tickets.detail.created")}</p>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{dStr(ticket.creationTime)}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{tStr(ticket.creationTime)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function InternalNote({ note }: { note: string }) {
  const t = useT()
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {t("pages_tickets.tickets.detail.internal_note")}
      </div>
      <div className="p-4 bg-warning/10 border-s-4 border-warning rounded-lg shadow-sm">
        <p className="text-sm leading-relaxed text-foreground/90">{note}</p>
      </div>
    </div>
  )
}

function TicketHeader({
  ticket,
  onBack,
  isConnected,
  isConnecting,
}: {
  ticket: Ticket
  onBack: () => void
  isConnected: boolean
  isConnecting: boolean
}) {
  const t = useT()
  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Button onClick={onBack} variant="ghost" size="icon" aria-label={t("common.back")}>
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold truncate">{ticket.title}</h1>
            <p className="text-sm text-muted-foreground font-mono">{ticket.reference}</p>
          </div>
        </div>
        <ConnectionStatus isConnected={isConnected} isConnecting={isConnecting} />
      </div>
    </div>
  )
}

function TicketChat({
  messages,
  currentUserId,
  onUpdateMessage,
  onSendMessage,
  isConnected,
}: {
  messages: TicketMessage[]
  currentUserId: string
  onUpdateMessage: (id: string, text: string) => Promise<void>
  onSendMessage: (text: string, note?: string) => Promise<void>
  isConnected: boolean
}) {
  const t = useT()
  return (
    <div className="flex flex-1 flex-col bg-background">
      <MessageThread messages={messages} currentUserId={currentUserId} onUpdateMessage={onUpdateMessage} />
      <MessageComposer
        onSend={onSendMessage}
        disabled={false}
        placeholder={
          isConnected
            ? t("pages_tickets.tickets.detail.type_message")
            : t("pages_tickets.tickets.connection.connecting")
        }
      />
    </div>
  )
}

function ModernTicketInfo({ ticket }: { ticket: Ticket }) {
  const customer = ticket.userInfo?.entity
  const customerId = customer?.id || ticket.userInfo?.id || "unknown"
  const avatarColor = getAvatarColor(customerId)
  const { name: statusLabel } = useEnumName("ticket-status", ticket.status)

  return (
    <div className="w-96 border-e bg-muted/20 overflow-y-auto">
      <div className="p-6 space-y-6">
        <CustomerCard customer={customer} avatarColor={avatarColor} />
        <Separator />
        <StatusSection status={ticket.status} label={statusLabel} />
        <Separator />
        <TicketDetailsGrid ticket={ticket} />
        {ticket.note && (
          <>
            <Separator />
            <InternalNote note={ticket.note} />
          </>
        )}
      </div>
    </div>
  )
}

export function CRMDetailView() {
  const router = useRouter()
  const t = useT()

  const {
    ticket,
    messages,
    isLoading,
    error,
    currentUserId,
    isConnected,
    isConnecting,
    handleSendMessage,
    handleUpdateMessage,
  } = useTicketDetail()

  if (isLoading) return <LoadingState />
  if (error || !ticket)
    return (
      <ErrorState
        error={error || t("pages_tickets.tickets.detail.not_found")}
        onBack={() => router.push("/tickets")}
        t={t}
      />
    )

  return (
    <div className="flex h-[calc(100vh-150px)] flex-col bg-background">
      <TicketHeader
        ticket={ticket}
        onBack={() => router.push("/tickets")}
        isConnected={isConnected}
        isConnecting={isConnecting}
      />

      <div className="flex flex-1 overflow-hidden">
        <ModernTicketInfo ticket={ticket} />
        <TicketChat
          messages={messages}
          currentUserId={currentUserId}
          onUpdateMessage={handleUpdateMessage}
          onSendMessage={handleSendMessage}
          isConnected={isConnected}
        />
      </div>
    </div>
  )
}
