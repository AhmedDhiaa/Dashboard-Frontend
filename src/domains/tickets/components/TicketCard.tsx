"use client"

import React from "react"
import { Calendar, User, Hash, MessageSquare, ChevronRight, CheckCircle, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/ui/design-system/primitives/card"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Button } from "@/ui/design-system/primitives/button"
import { useT } from "@/shared/config"
import { useEnumName } from "@/core/enums"
import { Ticket, TicketStatus } from "../types"
import { format } from "date-fns"

interface TicketCardProps {
  ticket: Ticket
  onClick?: (ticket: Ticket) => void
  onAction?: (action: "view" | "edit" | "delete" | "close", ticket: Ticket) => void
}

type StatusVariant = "info" | "warning" | "success" | "muted" | "destructive" | "outline"

const getStatusVariant = (status: TicketStatus): StatusVariant => {
  switch (status) {
    case TicketStatus.OPEN:
      return "info"
    case TicketStatus.CLOSED:
      return "muted"
    default:
      return "outline"
  }
}

function TicketHeader({
  ticket,
  variant,
  statusLabel,
  onAction,
}: {
  ticket: Ticket
  variant: StatusVariant
  statusLabel: string
  onAction?: (action: "view" | "edit" | "delete" | "close", ticket: Ticket) => void
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border">
          <Hash className="h-6 w-6 stroke-[2.5px]" />
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 leading-none mb-1.5">
            {ticket.reference}
          </p>
          <Badge
            variant={variant}
            className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg border-none"
          >
            {statusLabel}
          </Badge>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="relative z-20 h-10 w-10 rounded-lg opacity-0 transition-colors duration-200 group-hover:opacity-100 group-hover:bg-muted group-hover:text-foreground"
        onClick={e => {
          e.stopPropagation()
          onAction?.("view", ticket)
        }}
        title={useT()("common.view_details")}
      >
        <ChevronRight className="h-6 w-6 stroke-[2.5px]" />
      </Button>
    </div>
  )
}

function TicketInfoGrid({ ticket, t }: { ticket: Ticket; t: (k: string) => string }) {
  const dStr = (d?: string) => (d ? format(new Date(d), "MMM dd, yyyy HH:mm") : "-")
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground/80 group-hover:text-foreground transition-colors">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border transition-colors">
          <User className="h-4.5 w-4.5" />
        </div>
        <span className="truncate">{ticket.userInfo?.entity?.name || t("common.placeholders.no_name")}</span>
      </div>
      <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground/80 group-hover:text-foreground transition-colors">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground border border-border transition-colors">
          <Calendar className="h-4.5 w-4.5" />
        </div>
        <span>{dStr(ticket.date)}</span>
      </div>
    </div>
  )
}

export const TicketCard = React.memo(({ ticket, onClick, onAction }: TicketCardProps) => {
  const t = useT()
  const { name: statusLabel } = useEnumName("ticket-status", Number(ticket.status))
  const variant = getStatusVariant(ticket.status)

  const handleAction = (action: "view" | "edit" | "delete" | "close", tObj: Ticket) => {
    const event = new CustomEvent("ticket:action", {
      detail: { action, ticket: tObj },
    })
    window.dispatchEvent(event)
    onAction?.(action, tObj)
  }

  return (
    <div className="h-full">
      <Card
        className="group relative h-full cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-colors duration-200 hover:border-foreground/15"
        onClick={() => onClick?.(ticket)}
      >
        <CardContent className="p-7">
          <TicketHeader ticket={ticket} variant={variant} statusLabel={statusLabel} onAction={handleAction} />

          <h3 className="mb-6 line-clamp-2 text-xl font-black tracking-tight leading-snug text-foreground transition-colors min-h-[3.5rem]">
            {ticket.title}
          </h3>

          <TicketInfoGrid ticket={ticket} t={t} />

          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-black text-muted-foreground transition-colors">
              <MessageSquare className="h-4 w-4" />
              <span>{ticket.messages?.length || 0}</span>
            </div>

            <div className="flex items-center gap-1.5 relative z-30">
              {Number(ticket.status) !== TicketStatus.CLOSED && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative z-40 h-9 w-9 text-success hover:bg-success/10 rounded-lg transition-colors pointer-events-auto"
                  onClick={e => {
                    e.stopPropagation()
                    handleAction("close", ticket)
                  }}
                  title={t("common.close")}
                >
                  <CheckCircle className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="relative z-40 h-9 w-9 text-primary hover:bg-primary/10 rounded-lg transition-colors pointer-events-auto"
                onClick={e => {
                  e.stopPropagation()
                  handleAction("edit", ticket)
                }}
                title={t("common.edit")}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-40 h-9 w-9 text-destructive hover:bg-destructive/10 rounded-lg transition-colors pointer-events-auto"
                onClick={e => {
                  e.stopPropagation()
                  handleAction("delete", ticket)
                }}
                title={t("common.delete")}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

TicketCard.displayName = "TicketCard"
