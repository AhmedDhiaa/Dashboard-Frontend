/**
 * Strict Type Definitions for Field System
 * Eliminates 'any' types across renderers, columns, and autocomplete
 */

/**
 * All possible field value types
 */
export type FieldValue = string | number | boolean | Date | null | undefined | Record<string, unknown> | Array<unknown>

/**
 * Tree node type (for tree-view component)
 */
export interface TreeNode {
  id: string | number
  parentId?: string | number | null
  name: string
  children?: TreeNode[]
  [key: string]: FieldValue | TreeNode[]
}
