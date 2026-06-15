import { useCallback, useState } from "react"
import { PermissionNode } from "./types"

export function useEntityCardState(
  node: PermissionNode,
  permissions: Record<string, boolean>,
  onToggle: (name: string, checked: boolean) => void,
) {
  const [showAttributes, setShowAttributes] = useState(false)
  const rootGranted = permissions[node.root.name] || false
  const hasActions = node.actions.length > 0
  const hasAttributes = node.attributes.length > 0
  const attrGrantedCount = node.attributes.filter(a => permissions[a.name]).length
  const allAttrGranted = node.attributes.length > 0 && attrGrantedCount === node.attributes.length
  const someAttrGranted = attrGrantedCount > 0 && !allAttrGranted
  const actionGrantedCount = node.actions.filter(a => permissions[a.name]).length
  const allActionsGranted = node.actions.length > 0 && actionGrantedCount === node.actions.length
  const totalChildren =
    node.actions.length +
    node.attributes.length +
    Object.values(node.subActionMap).reduce((sum, arr) => sum + arr.length, 0)
  const grantedChildren =
    [...node.actions, ...node.attributes].filter(p => permissions[p.name]).length +
    Object.values(node.subActionMap)
      .flat()
      .filter(p => permissions[p.name]).length

  const handleToggleAll = useCallback(
    (value: boolean) => {
      onToggle(node.root.name, value)
      node.actions.forEach(a => {
        onToggle(a.name, value)
        const subs = node.subActionMap[a.name]
        if (subs) subs.forEach(s => onToggle(s.name, value))
      })
      node.attributes.forEach(a => onToggle(a.name, value))
    },
    [node, onToggle],
  )
  const handleToggleAllAttributes = useCallback(
    (value: boolean) => {
      node.attributes.forEach(a => onToggle(a.name, value))
    },
    [node.attributes, onToggle],
  )
  const handleToggleAllActions = useCallback(
    (value: boolean) => {
      node.actions.forEach(a => {
        onToggle(a.name, value)
        const subs = node.subActionMap[a.name]
        if (subs) subs.forEach(s => onToggle(s.name, value))
      })
    },
    [node.actions, node.subActionMap, onToggle],
  )
  const toggleShowAttrs = useCallback(() => setShowAttributes(v => !v), [])

  return {
    showAttributes,
    rootGranted,
    hasActions,
    hasAttributes,
    attrGrantedCount,
    allAttrGranted,
    someAttrGranted,
    actionGrantedCount,
    allActionsGranted,
    totalChildren,
    grantedChildren,
    handleToggleAll,
    handleToggleAllAttributes,
    handleToggleAllActions,
    toggleShowAttrs,
  }
}
