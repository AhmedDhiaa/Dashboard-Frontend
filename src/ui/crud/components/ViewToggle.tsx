"use client"

import { LayoutGrid, Table as TableIcon } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { cn } from "@/shared/utils"

interface ViewToggleProps {
  mode: "table" | "card"
  onChange: (mode: "table" | "card") => void
  className?: string
}

export function ViewToggle({ mode, onChange, className }: ViewToggleProps) {
  return (
    <div
      className={cn("flex items-center bg-muted/30 p-1 rounded-xl border border-border/50 backdrop-blur-sm", className)}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange("table")}
        className={cn(
          "h-8 px-3 rounded-lg transition-all duration-300",
          mode === "table" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <TableIcon size={16} className="me-2" />
        <span className="text-xs font-bold uppercase tracking-wider">Table</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange("card")}
        className={cn(
          "h-8 px-3 rounded-lg transition-all duration-300",
          mode === "card" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutGrid size={16} className="me-2" />
        <span className="text-xs font-bold uppercase tracking-wider">Cards</span>
      </Button>
    </div>
  )
}
