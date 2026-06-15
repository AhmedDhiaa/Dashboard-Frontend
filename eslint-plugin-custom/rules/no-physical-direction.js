/**
 * ESLint Rule: no-physical-direction
 *
 * Flags Tailwind's *physical* direction utilities (pl-/pr-/ml-/mr-/
 * left-/right-/text-left/text-right) so that the codebase can stay
 * RTL-correct without per-component `isRTL ? ... : ...` ternaries.
 *
 * What gets flagged
 * -----------------
 * The rule scans string literals that appear inside class-string contexts:
 *   - `className` JSX attribute values
 *   - the `class` JSX attribute (HTML interop)
 *   - arguments to common class helpers: `cn(...)`, `clsx(...)`, `cva(...)`,
 *     `tw(...)`, `twMerge(...)`, `tv(...)`
 *
 * Strings outside those contexts (CSS variable names like `--left-width`,
 * string comparisons, regular prose) are intentionally not checked. The
 * rule is meant to catch *new* layout violations, not police every English
 * word containing "left".
 *
 * What is NOT flagged
 * -------------------
 *   - Tailwind animation primitives keep `slide-in-from-left-2` etc.; they
 *     describe the animation's vector, not the layout's edge.
 *   - Pseudo-class selectors like `data-[side=left]:...` describe a Radix
 *     placement (which is itself physical and tied to the popper side),
 *     so the matching animation direction is correct as written.
 *   - The Tailwind classes `inset-y-*`, `inset-x-*`, `inset-*` are kept
 *     because they apply to both physical sides simultaneously and are
 *     direction-agnostic.
 *
 * Replacements (suggestions)
 * --------------------------
 *   pl-X    → ps-X        (padding-inline-start)
 *   pr-X    → pe-X        (padding-inline-end)
 *   ml-X    → ms-X        (margin-inline-start)
 *   mr-X    → me-X        (margin-inline-end)
 *   left-X  → start-X
 *   right-X → end-X
 *   text-left  → text-start
 *   text-right → text-end
 */

"use strict"

// Class-helper function names whose string-literal arguments are class names.
const CLASS_HELPERS = new Set(["cn", "clsx", "cva", "tw", "twMerge", "tv", "classNames"])

// Pseudo / variant prefixes whose direction tokens describe an animation
// vector or a placement-relative origin, not a layout edge. Matches like
// `slide-in-from-left-2`, `slide-out-to-right-1/2`, `data-[side=left]:...`.
const ANIMATION_PREFIX_RE = /(?:slide-in-from-|slide-out-to-|fade-in-from-)/
const SIDE_VARIANT_RE = /\bdata-\[side=(?:left|right)\]:/

// Match a Tailwind class token containing a physical direction utility.
// Tokens are whitespace-delimited; the regex anchors on the start of a
// token so we don't false-trigger on substrings like "remaining-12".
//
// Captures the prefix so the replacement can be derived deterministically.
//                  ┌── responsive/state prefix(es) e.g. "lg:" or "hover:md:"
//                  │                ┌── the negative sign for negative margins
const CLASS_RE = /(^|\s)((?:[a-z-]+:)*-?)(pl|pr|ml|mr|left|right)(-[a-z0-9.[\]/\\%-]+)/g
const TEXT_RE = /(^|\s)((?:[a-z-]+:)*)(text-(?:left|right))\b/g

const REPLACEMENTS = {
  pl: "ps",
  pr: "pe",
  ml: "ms",
  mr: "me",
  left: "start",
  right: "end",
  "text-left": "text-start",
  "text-right": "text-end",
}

function isPseudoToken(token) {
  return ANIMATION_PREFIX_RE.test(token) || SIDE_VARIANT_RE.test(token)
}

function findViolations(value) {
  if (typeof value !== "string" || value.length === 0) return []
  const violations = []

  CLASS_RE.lastIndex = 0
  for (const m of value.matchAll(CLASS_RE)) {
    const fullToken = m[0].trimStart()
    if (isPseudoToken(fullToken)) continue
    const physical = m[3]
    const tail = m[4]
    const prefix = m[2]
    const replacement = `${prefix}${REPLACEMENTS[physical]}${tail}`
    violations.push({ token: `${prefix}${physical}${tail}`, suggestion: replacement })
  }

  TEXT_RE.lastIndex = 0
  for (const m of value.matchAll(TEXT_RE)) {
    const fullToken = m[0].trimStart()
    if (isPseudoToken(fullToken)) continue
    const physical = m[3]
    const prefix = m[2]
    const replacement = `${prefix}${REPLACEMENTS[physical]}`
    violations.push({ token: `${prefix}${physical}`, suggestion: replacement })
  }

  return violations
}

function reportNode(context, node, value) {
  const violations = findViolations(value)
  for (const v of violations) {
    context.report({
      node,
      messageId: "physicalDirection",
      data: { token: v.token, suggestion: v.suggestion },
    })
  }
}

function isClassAttribute(node) {
  if (!node || node.type !== "JSXAttribute") return false
  const name = node.name && node.name.name
  return name === "className" || name === "class"
}

function isClassHelperCall(node) {
  if (!node || node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee.type === "Identifier") return CLASS_HELPERS.has(callee.name)
  if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
    return CLASS_HELPERS.has(callee.property.name)
  }
  return false
}

// Walk a string-bearing expression: literal, template, conditional, logical, array.
function visitClassExpression(context, node) {
  if (!node) return
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") reportNode(context, node, node.value)
      return
    case "TemplateLiteral":
      for (const quasi of node.quasis) reportNode(context, quasi, quasi.value.cooked)
      for (const expr of node.expressions) visitClassExpression(context, expr)
      return
    case "ConditionalExpression":
      visitClassExpression(context, node.consequent)
      visitClassExpression(context, node.alternate)
      return
    case "LogicalExpression":
      visitClassExpression(context, node.left)
      visitClassExpression(context, node.right)
      return
    case "BinaryExpression":
      if (node.operator === "+") {
        visitClassExpression(context, node.left)
        visitClassExpression(context, node.right)
      }
      return
    case "ArrayExpression":
      for (const el of node.elements) visitClassExpression(context, el)
      return
    case "ObjectExpression":
      // clsx({ "ml-2": cond }) — keys are class names
      for (const prop of node.properties) {
        if (prop.type !== "Property") continue
        if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
          reportNode(context, prop.key, prop.key.value)
        }
      }
      return
    default:
      return
  }
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Tailwind physical-direction utilities (pl-/pr-/ml-/mr-/left-/right-/text-left/text-right). Use logical equivalents (ps-/pe-/ms-/me-/start-/end-/text-start/text-end) so the layout stays correct under RTL.",
      category: "Accessibility",
      recommended: true,
    },
    messages: {
      physicalDirection:
        "Avoid the physical-direction class `{{token}}`. Use the logical equivalent `{{suggestion}}` so the layout flips correctly under RTL.",
    },
    schema: [],
  },

  create(context) {
    return {
      JSXAttribute(node) {
        if (!isClassAttribute(node)) return
        const v = node.value
        if (!v) return
        if (v.type === "Literal") {
          reportNode(context, v, v.value)
          return
        }
        if (v.type === "JSXExpressionContainer") {
          visitClassExpression(context, v.expression)
        }
      },

      CallExpression(node) {
        if (!isClassHelperCall(node)) return
        for (const arg of node.arguments) visitClassExpression(context, arg)
      },
    }
  },
}
