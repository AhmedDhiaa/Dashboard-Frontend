"use client"

/**
 * Helpers for the color controls.
 *
 * Token values are full CSS color strings — `oklch(...)`, `#rrggbb`, named
 * colors, anything. A native `<input type="color">` only accepts `#rrggbb`,
 * so we resolve an arbitrary CSS color to a hex string by letting the browser
 * compute it (set it on a throwaway element, read back `getComputedStyle`,
 * then convert the resulting `rgb()` to hex). When a value can't be resolved
 * (SSR, empty, invalid) we fall back to a neutral mid-grey so the swatch still
 * renders something sensible.
 */

const FALLBACK_HEX = "#888888"

/** Clamp a 0–255 channel and render it as a two-digit hex pair. */
function channelToHex(n: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(n)))
  return clamped.toString(16).padStart(2, "0")
}

/**
 * Resolve any CSS color string to `#rrggbb`. Returns FALLBACK_HEX when the
 * input is empty/invalid or when running without a DOM.
 */
export function cssColorToHex(value: string | undefined): string {
  const input = value?.trim()
  if (!input) return FALLBACK_HEX
  // Already a 6-digit hex — use as-is (drop any alpha).
  const hexMatch = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(input)
  if (hexMatch?.[1]) return `#${hexMatch[1].toLowerCase()}`
  if (typeof document === "undefined") return FALLBACK_HEX

  const probe = document.createElement("span")
  probe.style.color = ""
  probe.style.color = input
  // An invalid value leaves color as "" (the assignment above is ignored).
  if (!probe.style.color) return FALLBACK_HEX

  probe.style.display = "none"
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  document.body.removeChild(probe)

  const rgb = /rgba?\(([^)]+)\)/.exec(computed)
  if (!rgb?.[1]) return FALLBACK_HEX
  const parts = rgb[1].split(",").map(p => parseFloat(p.trim()))
  const [r, g, b] = parts
  if (r === undefined || g === undefined || b === undefined || [r, g, b].some(n => Number.isNaN(n))) {
    return FALLBACK_HEX
  }
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`
}
