"use client"
// Calls useT()/useLocale() — required to be a Client Component.
// Enforced by scripts/check-rsc-boundaries.mjs.

/**
 * Universal Dynamic Items Table Component
 *
 * A fully dynamic, reusable component for displaying line items in any entity.
 * Configurable columns, responsive design, premium UI.
 */

import React from "react"
import { useT } from "@/shared/config"
import { Package } from "lucide-react"

export interface ItemColumn {
  /** Field path in the item object (supports nested like "itemInfo.entity.name") */
  field: string
  /** Translation key for column header */
  labelKey: string
  /** Column type for formatting */
  type?: "text" | "number" | "badge" | "nested-name" | "nested-code"
  /** Text alignment */
  align?: "start" | "end" | "center"
  /** Custom render function */
  render?: (value: unknown, item: Record<string, unknown>) => React.ReactNode
}

export interface ItemsSummaryCard {
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>
  /** Translation key for label */
  labelKey: string
  /** Field to sum or count */
  field?: string
  /** Aggregation type */
  aggregation: "count" | "sum"
  /** Color theme */
  color?: "primary" | "secondary" | "accent"
}

export interface DynamicItemsTableProps {
  /** Array of items to display */
  items: Array<Record<string, unknown>>
  /** Column configuration */
  columns: ItemColumn[]
  /** Optional summary cards */
  summaryCards?: ItemsSummaryCard[]
  /** Translation key for "no items" message */
  noItemsKey?: string
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current, key) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj as unknown)
}

/**
 * Universal Dynamic Items Table
 */
/**
 * Sub-component for summary cards
 */
const SummarySection: React.FC<{
  cards: ItemsSummaryCard[]
  items: Array<Record<string, unknown>>
  t: (key: string) => string
}> = ({ cards, items, t }) => {
  const getSummaryValue = (card: ItemsSummaryCard) => {
    if (card.aggregation === "count") return items.length
    if (card.aggregation === "sum" && card.field) {
      return items.reduce((sum, item) => {
        const value = getNestedValue(item, card.field!)
        return sum + (typeof value === "number" ? value : 0)
      }, 0)
    }
    return 0
  }

  const getColorClasses = (color?: string) => {
    switch (color) {
      case "primary":
        return "bg-primary/5 border-primary/10 text-primary"
      case "secondary":
        return "bg-secondary/5 border-secondary/10 text-secondary"
      case "accent":
        return "bg-accent/5 border-accent/10 text-accent"
      default:
        return "bg-primary/5 border-primary/10 text-primary"
    }
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-${Math.min(cards.length, 3)} gap-4`}>
      {cards.map((card, index) => {
        const Icon = card.icon
        const value = getSummaryValue(card)
        const colorClasses = getColorClasses(card.color)
        return (
          <div key={index} className={`p-4 rounded-xl border ${colorClasses}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${colorClasses.replace("/5", "/10")}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{t(card.labelKey)}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Sub-component for a single table row
 */
const TableRow: React.FC<{
  item: Record<string, unknown>
  index: number
  columns: ItemColumn[]
}> = ({ item, index, columns }) => (
  <tr className="hover:bg-muted/30 transition-colors duration-200">
    <td className="px-4 py-4 text-sm text-muted-foreground font-medium">{index + 1}</td>
    {columns.map((column, colIndex) => {
      const value = getNestedValue(item, column.field)
      return (
        <td key={colIndex} className={`px-4 py-4 text-${column.align || "start"}`}>
          {column.render ? (
            column.render(value, item)
          ) : column.type === "nested-name" ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{String(value || column.field)}</p>
            </div>
          ) : column.type === "badge" ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary/10 text-secondary">
              <span className="text-sm font-medium">{String(value || "")}</span>
            </div>
          ) : column.type === "number" ? (
            <span className="text-sm font-bold text-primary">{String(value || 0)}</span>
          ) : (
            <span className="text-sm text-foreground">{String(value || "")}</span>
          )}
        </td>
      )
    })}
  </tr>
)

/**
 * Universal Dynamic Items Table
 */
export const DynamicItemsTable: React.FC<DynamicItemsTableProps> = ({
  items,
  columns,
  summaryCards,
  noItemsKey = "pages.common.no_items",
}) => {
  const t = useT()

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="p-4 rounded-full bg-muted/50 mb-4">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">{t(noItemsKey)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {summaryCards && summaryCards.length > 0 && <SummarySection cards={summaryCards} items={items} t={t} />}

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border/50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  #
                </th>
                {columns.map((column, index) => (
                  <th
                    key={index}
                    className={`px-4 py-3 text-${column.align || "start"} text-xs font-semibold text-muted-foreground uppercase tracking-wider`}
                  >
                    {t(column.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {items.map((item, index) => (
                <TableRow key={(item.id as string) || index} item={item} index={index} columns={columns} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
