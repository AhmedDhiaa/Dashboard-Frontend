/**
 * ESLint Rule: no-string-permission-key
 *
 * Flags fully-qualified permission-key string literals (`Api.<Module>.<Action>`
 * or `Api.<Module>.<SubModule>`) that appear anywhere outside the single
 * source of truth `src/shared/auth/permission-keys.ts`. The motivation
 * is that a typo in a permission literal silently denies access — there's
 * no compile-time signal that the gate is wrong.
 *
 * What gets flagged
 * -----------------
 *   const X = "Api.Theme.Manage"             ← block
 *   { permissionKey: "Api.Order.Create" }    ← block
 *   t("Api.Foo.Bar")                          ← block (any string-literal context)
 *
 * What is NOT flagged
 * -------------------
 *   "Api.Brand"                              — two-segment entity prefix; owned
 *                                              by the entity config that anchors it.
 *   `Api.${something}.Create`                 — template literals with expressions
 *                                              are skipped (this rule only catches
 *                                              fully-static literals).
 *
 * Configuration
 * -------------
 *   {
 *     "allowFiles": [
 *       "src/shared/auth/permission-keys.ts",
 *       "src/shared/test-utils/**",
 *       "src/app/(dashboard)/system/api-settings/_utils.ts",
 *       "**\/*.test.{ts,tsx}",
 *       "**\/__tests__/**"
 *     ]
 *   }
 *
 * Adding a file to allowFiles should be a deliberate, justified decision —
 * the wider this allowlist grows, the less the rule earns its keep.
 */

"use strict"

const path = require("node:path")

// `Api.<Module>.<Action>` — at least two dots, each segment starts with an
// uppercase letter. Tightened with `^...$` anchors so we only catch literal
// permission keys, not "log line: Api.Foo.Bar happened" prose strings.
const PERMISSION_KEY_RE = /^Api\.[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]+$/

// Same glob-to-regex conversion as `no-static-heavy-import` — kept local to
// keep each rule self-contained.
function globToRegex(glob) {
  let out = ""
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === "*" && glob[i + 1] === "*") {
      out += ".*"
      i++
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
  return (globs || []).map(g => globToRegex(g.replaceAll("\\", "/")))
}

function isAllowed(filePath, compiled) {
  const rel = path.relative(process.cwd(), filePath).replaceAll("\\", "/")
  return compiled.some(re => re.test(rel))
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Block fully-qualified permission-key string literals (`Api.X.Y`) outside `src/shared/auth/permission-keys.ts`. A typo in a permission literal silently denies access; routing every key through the central `PERMISSIONS` map gives renames a single touch-point and surfaces typos as TypeScript errors.",
      category: "Security",
      recommended: true,
    },
    messages: {
      stringPermissionKey:
        "Permission key `{{key}}` is hard-coded as a string literal. Import the constant from `@/shared/auth/permission-keys` instead — that file is the single source of truth and the only place where these literals are allowed.",
    },
    schema: [
      {
        type: "object",
        properties: {
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
    const allowlist = compileAllowlist(opts.allowFiles)

    const filename = context.filename || context.getFilename()
    if (isAllowed(filename, allowlist)) return {}

    function reportIfMatch(node, value) {
      if (typeof value !== "string") return
      if (!PERMISSION_KEY_RE.test(value)) return
      context.report({
        node,
        messageId: "stringPermissionKey",
        data: { key: value },
      })
    }

    return {
      Literal(node) {
        reportIfMatch(node, node.value)
      },
      // Pure template literals (no `${...}` expressions) — the cooked
      // string is the literal value, equivalent to a `Literal` node.
      TemplateLiteral(node) {
        if (node.expressions.length !== 0) return
        const quasi = node.quasis[0]
        if (!quasi) return
        reportIfMatch(node, quasi.value.cooked)
      },
    }
  },
}
