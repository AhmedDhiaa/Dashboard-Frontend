/**
 * Effective-value + numeric helpers shared by every Theme Studio control.
 *
 * The studio seeds each control from the REAL current value, computed as
 *   draft[key] ?? live[key] ?? defaultValue
 * so a control never shows "(default)" — it shows the true value, plus a small
 * "default" / "overridden" badge to communicate where that value comes from.
 */

import { defaultValueFor } from "./token-catalog"

export type ValueOrigin = "default" | "live" | "draft"

export interface EffectiveValue {
  /** The value to display/seed the control with. */
  value: string
  /** Where it came from. */
  origin: ValueOrigin
  /** draft differs from the live/default baseline (the control is "dirty"). */
  dirty: boolean
  /** an override exists at all (draft or live differs from the built-in default). */
  overridden: boolean
}

/**
 * Resolve the effective value for a token across draft → live → default.
 * `dirty` means the in-progress draft differs from what is published/built-in;
 * `overridden` means the effective value differs from the built-in default.
 */
export function effectiveValue(
  key: string,
  draft: Record<string, string>,
  live: Record<string, string>,
): EffectiveValue {
  const def = defaultValueFor(key)
  const hasDraft = key in draft
  const hasLive = key in live
  const value = (hasDraft ? draft[key] : hasLive ? live[key] : def) ?? def

  const baseline = hasLive ? live[key] ?? "" : def
  const dirty = hasDraft && (draft[key] ?? "") !== baseline
  const overridden = (value ?? "").trim() !== (def ?? "").trim() && value.trim() !== ""

  let origin: ValueOrigin = "default"
  if (hasDraft) origin = "draft"
  else if (hasLive) origin = "live"

  return { value, origin, dirty, overridden }
}

/** Parse the leading number out of a CSS value (e.g. "0.625rem" → 0.625). */
export function numericPart(value: string | undefined, fallback = 0): number {
  if (!value) return fallback
  const match = /-?\d*\.?\d+/.exec(value)
  if (!match) return fallback
  const n = parseFloat(match[0])
  return Number.isFinite(n) ? n : fallback
}

/** Format a slider's numeric value back into a CSS string with its unit. */
export function formatWithUnit(n: number, unit: string | undefined): string {
  // Trim float noise: at most 4 decimals, no trailing zeros.
  const rounded = Math.round(n * 10000) / 10000
  return `${rounded}${unit ?? ""}`
}

/** Pretty short display for a numeric value (used in slider headers). */
export function displayNumber(n: number, step: number | undefined): string {
  const decimals = step && step < 0.1 ? 3 : step && step < 1 ? 2 : 2
  const fixed = n.toFixed(decimals)
  // strip trailing zeros but keep at least one decimal-free integer
  return fixed.replace(/\.?0+$/, "")
}
