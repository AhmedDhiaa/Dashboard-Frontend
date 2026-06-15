"use client"

/**
 * Connection Status - Enhanced with better visual feedback
 */

import { WifiOff, Loader2 } from "lucide-react"
import { Badge } from "@/ui/design-system/primitives/badge"
import { useT } from "@/shared/config"
import { cn } from "@/shared/utils"

interface ConnectionStatusProps {
  isConnected: boolean
  isConnecting?: boolean
}

export function ConnectionStatus({ isConnected, isConnecting = false }: ConnectionStatusProps) {
  const t = useT("pages_tickets")
  if (isConnecting) {
    return (
      <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">
        <Loader2 className="me-1.5 h-3 w-3 animate-spin" />
        {t("tickets.connection.connecting")}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "transition-colors duration-200",
        isConnected
          ? "border-success/40 bg-success/10 text-success"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      {isConnected ? (
        <>
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
        </>
      )}
    </Badge>
  )
}
