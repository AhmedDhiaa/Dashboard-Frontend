/**
 * EntityTree Component
 *
 * A general-purpose, recursive tree component for displaying and managing hierarchical entities.
 * Supports:
 * - Recursive rendering of parent-child relationships
 * - Expand/Collapse states
 * - Custom actions (Add Child, Edit, Delete)
 * - Premium UI with animations and consistent theme
 *
 * @strict @enterprise-grade
 */

"use client"

import React, { useState, useMemo } from "react"
import { ChevronRight, ChevronDown, Plus, Edit, Trash2, Folder, File, FolderOpen, MoreVertical } from "lucide-react"
import { cn } from "@/shared/utils"
import { useT } from "@/shared/config"
import { Button } from "@/ui/design-system/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/design-system/primitives/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/design-system/primitives/tooltip"

interface EntityTreeProps<T> {
  items: T[]
  idField: keyof T
  parentIdField: keyof T
  labelField: keyof T
  orderField?: keyof T
  initialExpanded?: boolean
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  onAddChild?: (parent: T) => void
  onSelect?: (item: T) => void
  className?: string
}

export function EntityTree<T extends Record<string, unknown>>({
  items,
  idField,
  parentIdField,
  labelField,
  orderField,
  initialExpanded = false,
  onEdit,
  onDelete,
  onAddChild,
  onSelect,
  className,
}: EntityTreeProps<T>) {
  const t = useT("crud")
  // Build tree structure
  const tree = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemMap = new Map<any, T & { children: any[] }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roots: (T & { children: any[] })[] = []

    // First pass: create map
    items.forEach(item => {
      itemMap.set(item[idField], { ...item, children: [] })
    })

    // Second pass: link parents and children
    items.forEach(item => {
      const mapped = itemMap.get(item[idField])!
      const parentId = item[parentIdField]

      if (parentId && itemMap.has(parentId)) {
        itemMap.get(parentId)!.children.push(mapped)
      } else {
        roots.push(mapped)
      }
    })

    // Sort children if orderField exists
    if (orderField) {
      const sortFn = (a: T, b: T) => ((a[orderField] as number) || 0) - ((b[orderField] as number) || 0)
      roots.sort(sortFn)
      itemMap.forEach(item => {
        item.children.sort(sortFn)
      })
    }

    return roots
  }, [items, idField, parentIdField, orderField])

  return (
    <TooltipProvider>
      <div
        className={cn(
          "p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border/50 shadow-sm",
          className,
        )}
      >
        {tree.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground italic bg-muted/20 rounded-lg border border-dashed">
            {t("tree.no_items_in_hierarchy")}
          </div>
        ) : (
          <div className="space-y-1">
            {tree.map(node => (
              <TreeNode
                key={String(node[idField])}
                node={node}
                idField={idField}
                labelField={labelField}
                initialExpanded={initialExpanded}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onSelect={onSelect}
                level={0}
              />
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

interface TreeNodeProps<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: T & { children: any[] }
  idField: keyof T
  labelField: keyof T
  level: number
  initialExpanded: boolean
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  onAddChild?: (parent: T) => void
  onSelect?: (item: T) => void
}

// eslint-disable-next-line max-lines-per-function -- Tree node component with recursive rendering, expand/collapse, and action menu
function TreeNode<T extends Record<string, unknown>>({
  node,
  idField,
  labelField,
  level,
  initialExpanded,
  onEdit,
  onDelete,
  onAddChild,
  onSelect,
}: TreeNodeProps<T>) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded)
  const hasChildren = node.children.length > 0

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const itemLabel = String(node[labelField])

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer select-none border border-transparent",
          "hover:bg-primary/5 hover:border-primary/20 hover:shadow-sm",
          "active:scale-[0.99]",
        )}
        onClick={() => onSelect?.(node)}
        style={{ marginLeft: `${level * 20}px` }}
      >
        {/* Expand/Collapse Icon */}
        <div className="w-5 h-5 flex items-center justify-center">
          {hasChildren ? (
            <button
              onClick={handleToggle}
              className="p-0.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        {/* Node Icon */}
        <div className="text-primary-600 dark:text-primary-400">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 fill-primary/10" />
            ) : (
              <Folder className="h-4 w-4 fill-primary/10" />
            )
          ) : (
            <File className="h-4 w-4" />
          )}
        </div>

        {/* Label */}
        <div className="flex-1 truncate">
          <span className="text-sm font-medium text-foreground dark:text-foreground/90 group-hover:text-primary transition-colors">
            {itemLabel}
          </span>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(node.code as any) && (
            <span className="ms-2 font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded leading-none border">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {String(node.code as any)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          {onAddChild && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                  onClick={e => {
                    e.stopPropagation()
                    onAddChild(node)
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Sub-item</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {onEdit && (
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation()
                    onEdit(node)
                  }}
                >
                  <Edit className="h-4 w-4 me-2 text-secondary" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation()
                    onDelete(node)
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 me-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Recursive Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1 border-s border-border/40 ms-2.5">
          {node.children.map(child => (
            <TreeNode
              key={String(child[idField])}
              node={child}
              idField={idField}
              labelField={labelField}
              initialExpanded={initialExpanded}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
