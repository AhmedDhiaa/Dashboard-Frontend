"use client"

import { useEnumName } from "@/core/enums"
import type { EnumTypeName } from "@/core/enums"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { cn } from "@/shared/utils"

type BadgeVariant = "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "info"

interface EnumBadgeProps {
  enumType: EnumTypeName
  id: number | null | undefined
  className?: string
}

/**
 * Standardized badge for displaying enum values with dynamic translations
 */
export function EnumBadge({ enumType, id, className }: EnumBadgeProps) {
  const { name, loading } = useEnumName(enumType, id)

  if (loading) {
    return <Skeleton className="h-5 w-16 rounded-full" />
  }

  if (id === null || id === undefined) {
    return <span className="text-muted-foreground">-</span>
  }

  // Define variant-based styling based on enum type and ID
  // Style mappings for different enum types
  const statusMap: Record<number, BadgeVariant> = {
    1: "info",
    11: "info", // New / Pending
    2: "warning",
    8: "warning", // InProcess / Start
    3: "success",
    9: "success",
    10: "success",
    7: "success", // Approved / Completed / Paid / Delivered
    12: "destructive",
    13: "destructive",
    14: "destructive", // Rejected / Cancelled
  }

  const settlementMap: Record<number, BadgeVariant> = {
    1: "default", // Cash
    2: "info", // Card
    3: "warning", // Pos
    4: "secondary", // Wallet
    5: "success", // Loyalty
  }

  const getVariant = (): BadgeVariant => {
    if (enumType === "status" || enumType === "notification-status") {
      return statusMap[id] || "secondary"
    }

    if (enumType === "settlement-method") {
      return settlementMap[id] || "outline"
    }

    return "outline"
  }

  return (
    <Badge variant={getVariant()} className={cn("whitespace-nowrap font-bold", className)}>
      {name}
    </Badge>
  )
}
