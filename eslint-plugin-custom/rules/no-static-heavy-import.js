/**
 * ESLint Rule: no-static-heavy-import
 *
 * Flags top-level static imports of heavyweight client-side libraries from
 * any file outside a designated allowlist. The allowlist is the project's
 * record of "places where it's OK to statically import this lib because
 * the file itself is reached only through a `dynamic()` boundary (or is
 * the dynamic wrapper itself)."
 *
 * Why this matters
 * ----------------
 * Libraries like recharts (~80 KB gz), framer-motion (~30 KB gz), xlsx
 * (~250 KB gz), jspdf, react-easy-crop, cmdk, and @googlemaps/js-api-loader
 * all balloon route bundles when statically imported. We want them in
 * separate chunks fetched on-demand. A static import dragged into a
 * shared layout or list-page module costs every visitor on every visit,
 * even if they never trigger the feature.
 *
 * What gets flagged
 * -----------------
 *   import x from "recharts"              ← value import, blocked
 *   import { Bar } from "recharts"        ← named value import, blocked
 *   import * as r from "recharts"         ← namespace import, blocked
 *   import "recharts"                     ← side-effect import, blocked
 *
 * What is NOT flagged
 * -------------------
 *   import type { Foo } from "recharts"       ← type-only, erased at compile
 *   import { type Foo } from "recharts"       ← inline type-only specifier
 *   const m = await import("recharts")        ← dynamic import (the goal)
 *   dynamic(() => import("recharts"))         ← next/dynamic factory
 *
 * Configuration
 * -------------
 *   {
 *     "packages": ["recharts", "framer-motion", ...],   // libraries to police
 *     "allowFiles": [                                    // glob patterns relative to cwd
 *       "src/shared/lazy/**",
 *       "src/features/dashboard/components/**"
 *     ]
 *   }
 *
 * Allowlist semantics: a file matching any glob is exempt for ALL listed
 * packages. The allowlist is meant to track files that:
 *   (a) are themselves wrapped in `next/dynamic` or `lazy()` by their
 *       single consumer, OR
 *   (b) live inside a directory whose root file is dynamic-imported
 *       (e.g. all dashboard widgets are reached via `dynamic(() =>
 *       import("@/features/dashboard"))` from the dashboard route).
 *
 * Adding a file to the allowlist should mean documenting *who* dynamic-
 * imports it; reviewers should require that justification in PRs.
 */

"use strict"

const path = require("node:path")

// Convert a glob with `**` and `*` into a RegExp source. Used for matching
// the rule's `allowFiles` patterns against a file's project-relative path.
// Supports the small subset we need: `**`, `*`, `?`. Other glob features
// (negation, brace expansion) are intentionally not supported — keep the
// allowlist literal so reviewers can scan it.
function globToRegex(glob) {
  let out = ""
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === "*" && glob[i + 1] === "*") {
      out += ".*"
      i++ // skip second *
      // Skip a trailing /
      if (glob[i + 1] === "/") i++
    } else if (c === "*") {
      out += "[^/]*"
    } else if (c === "?") {
      out += "."
    } else if ("\\^$+|()[]{}.".includes(c)) {
      out += "\\" + c
    } else {
      out += c
    }
  }
  return new RegExp("^" + out + "$")
}

function compileAllowlist(globs) {
  return (globs || []).map(g => ({ glob: g, re: globToRegex(g.replaceAll("\\", "/")) }))
}

function isAllowed(filePath, compiled) {
  const rel = path.relative(process.cwd(), filePath).replaceAll("\\", "/")
  return compiled.some(({ re }) => re.test(rel))
}

// True when the import statement only carries TS type metadata. Covers
// both the statement-level form (`import type { X } from "..."`) and the
// case where every specifier is inline-typed (`import { type X } from
// "..."`). Side-effect imports (`import "..."`) and value specifiers
// always return false.
function isTypeOnly(node) {
  if (node.importKind === "type") return true
  if (!node.specifiers || node.specifiers.length === 0) return false
  return node.specifiers.every(s => s.importKind === "type")
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Block top-level value imports of heavyweight libraries (recharts, framer-motion, xlsx, jspdf, react-easy-crop, cmdk, @googlemaps/js-api-loader) from files outside a designated dynamic-boundary allowlist. Use `next/dynamic` at the consumer, or move the import into an allowlisted wrapper file.",
      category: "Performance",
      recommended: true,
    },
    messages: {
      staticHeavy:
        "Static value import of `{{pkg}}` is not allowed here. This file is not on the dynamic-boundary allowlist, so the import will land in the route's first-load JS. Either (a) wrap the consumer in `next/dynamic(() => import(...))`, or (b) add this file to the rule's `allowFiles` option (only if a single consumer dynamic-imports it).",
    },
    schema: [
      {
        type: "object",
        properties: {
          packages: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
          allowFiles: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const opts = context.options[0] || {}
    const packages = new Set(opts.packages || [])
    const allowlist = compileAllowlist(opts.allowFiles)
    if (packages.size === 0) return {}

    const filename = context.filename || context.getFilename()
    const fileAllowed = isAllowed(filename, allowlist)
    if (fileAllowed) return {}

    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        if (typeof source !== "string") return
        if (!packages.has(source)) return
        if (isTypeOnly(node)) return
        context.report({
          node,
          messageId: "staticHeavy",
          data: { pkg: source },
        })
      },
    }
  },
}
