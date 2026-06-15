/**
 * Immutable setter that walks a dot-path (or pre-split array) into a
 * nested object/array and returns a new structure with the value
 * replaced at the leaf.
 *
 * Properties:
 *   - Path forms: "button.label" or ["button", "label"].
 *   - Numeric segments are treated as array indices ("tabs.0.label").
 *   - Each step shallow-clones the parent on the way back up — branches
 *     untouched by the write preserve their reference (structural
 *     sharing).
 *   - Missing intermediates are created (object by default, array when
 *     the next segment is numeric).
 *   - The original input is never mutated.
 *
 * Used by the canvas to apply inline-edit commits where the field key
 * may be nested (`button.label`, `tabs.0.label`, `items.2.title`).
 */
export function setDeep<T>(target: T, path: string | string[], value: unknown): T {
  const segments = Array.isArray(path) ? path : path.split(".")
  if (segments.length === 0) return value as T

  const [head, ...rest] = segments
  if (head === undefined) return target

  if (rest.length === 0) {
    return assoc(target, head, value)
  }

  const currentChild = readChild(target, head)
  const nextSegmentIsIndex = /^\d+$/.test(rest[0]!)
  const seed = currentChild ?? (nextSegmentIsIndex ? [] : {})
  const nextChild = setDeep(seed, rest, value)
  return assoc(target, head, nextChild)
}

function readChild(target: unknown, key: string): unknown {
  if (target == null) return undefined
  if (Array.isArray(target)) return target[Number(key)]
  if (typeof target === "object") return (target as Record<string, unknown>)[key]
  return undefined
}

function assoc<T>(target: T, key: string, value: unknown): T {
  if (Array.isArray(target)) {
    const next = target.slice()
    next[Number(key)] = value
    return next as unknown as T
  }
  if (target && typeof target === "object") {
    return { ...(target as object), [key]: value } as T
  }
  // Primitive/null parent — replace with a freshly seeded container.
  const isIndex = /^\d+$/.test(key)
  if (isIndex) {
    const next: unknown[] = []
    next[Number(key)] = value
    return next as unknown as T
  }
  return { [key]: value } as unknown as T
}
