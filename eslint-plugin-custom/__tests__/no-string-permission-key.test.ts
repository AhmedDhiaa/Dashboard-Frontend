/**
 * Unit test for the `no-string-permission-key` rule.
 *
 * RuleTester drives synthetic source strings through the rule. Same shape
 * as the `no-static-heavy-import` test — invocation lives at the top level
 * because RuleTester calls describe/it itself.
 */

import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const rule = require("../rules/no-string-permission-key.js")

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parser: tsParser,
  },
})

const opts = {
  allowFiles: ["src/shared/auth/permission-keys.ts", "**/*.test.ts"],
}

const fileIn = (rel: string) => path.resolve(process.cwd(), rel)

tester.run("no-string-permission-key", rule, {
  valid: [
    // Allowlisted source-of-truth file.
    {
      filename: fileIn("src/shared/auth/permission-keys.ts"),
      code: `export const X = "Api.Theme.Manage"`,
      options: [opts],
    },
    // Allowlisted test glob.
    {
      filename: fileIn("src/foo/bar.test.ts"),
      code: `const grants = ["Api.City.Update"]`,
      options: [opts],
    },
    // Two-segment entity prefix — required regex demands the second dot.
    {
      filename: fileIn("src/domains/brand/brand.config.ts"),
      code: `const cfg = { permissionKey: "Api.Brand" }`,
      options: [opts],
    },
    // Lowercase second segment — not a permission key by convention.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `const x = "Api.foo.bar"`,
      options: [opts],
    },
    // Template literal with an interpolation — the rule only catches static
    // strings, not dynamically constructed ones (those are reviewer territory).
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `const action = "Create"; const x = \`Api.Brand.\${action}\``,
      options: [opts],
    },
    // Substring inside a longer string — anchors prevent false positives.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `const log = "Saw key Api.Theme.Manage in payload"`,
      options: [opts],
    },
  ],
  invalid: [
    // Direct literal in a config object.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `const x = { permissionKey: "Api.Theme.Manage" }`,
      options: [opts],
      errors: [{ messageId: "stringPermissionKey", data: { key: "Api.Theme.Manage" } }],
    },
    // const initializer.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `const KEY = "Api.Order.Create"`,
      options: [opts],
      errors: [{ messageId: "stringPermissionKey", data: { key: "Api.Order.Create" } }],
    },
    // Function argument.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `requirePermission("Api.Admin.EntityBuilder")`,
      options: [opts],
      errors: [{ messageId: "stringPermissionKey", data: { key: "Api.Admin.EntityBuilder" } }],
    },
    // Pure template literal (no expressions) — equivalent to a Literal.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: "const x = `Api.Theme.Manage`",
      options: [opts],
      errors: [{ messageId: "stringPermissionKey", data: { key: "Api.Theme.Manage" } }],
    },
    // Three-or-more-segment key like a nested module path.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `const x = "Api.Report.WorkSessionReport"`,
      options: [opts],
      errors: [{ messageId: "stringPermissionKey", data: { key: "Api.Report.WorkSessionReport" } }],
    },
  ],
})
