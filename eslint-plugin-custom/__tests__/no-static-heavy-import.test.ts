/**
 * Unit test for the `no-static-heavy-import` rule.
 *
 * Drives ESLint's `RuleTester` over synthetic source strings — no real
 * files, no project lint pass — so the rule's pass/fail behavior is
 * pinned independent of which files happen to be on the project's
 * allowlist today.
 */

import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import path from "node:path"

// CommonJS rule loaded via dynamic require — keeps the test file pure ESM.
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const rule = require("../rules/no-static-heavy-import.js")

// RuleTester calls describe/it at the *call site*, not lazily — so we have
// to invoke `tester.run` at the top level. Wrapping it in a vitest
// `describe(... it(...))` block triggers vitest's "no nested suite" guard.
const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parser: tsParser,
  },
})

const opts = {
  packages: ["recharts", "framer-motion", "xlsx", "cmdk"],
  allowFiles: ["src/shared/lazy/**", "src/features/dashboard/components/**"],
}

const fileIn = (rel: string) => path.resolve(process.cwd(), rel)

tester.run("no-static-heavy-import", rule, {
  valid: [
    // Allowlisted directory — value import permitted.
    {
      filename: fileIn("src/features/dashboard/components/Foo.tsx"),
      code: `import { Bar } from "recharts"`,
      options: [opts],
    },
    // Allowlisted wrapper directory.
    {
      filename: fileIn("src/shared/lazy/charts.tsx"),
      code: `import { motion } from "framer-motion"`,
      options: [opts],
    },
    // Type-only import — always allowed regardless of file location.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `import type { Foo } from "recharts"`,
      options: [opts],
    },
    // Inline type-only specifiers — allowed when every specifier is typed.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `import { type Foo } from "recharts"`,
      options: [opts],
    },
    // Non-policed package — not flagged.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `import { useState } from "react"`,
      options: [opts],
    },
    // Dynamic import — not an ImportDeclaration, never matched.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `const m = (() => import("recharts"))()`,
      options: [opts],
    },
    // No options provided — rule is a no-op.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `import { Bar } from "recharts"`,
    },
  ],
  invalid: [
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `import { Bar } from "recharts"`,
      options: [opts],
      errors: [{ messageId: "staticHeavy", data: { pkg: "recharts" } }],
    },
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `import recharts from "recharts"`,
      options: [opts],
      errors: [{ messageId: "staticHeavy" }],
    },
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `import * as r from "recharts"`,
      options: [opts],
      errors: [{ messageId: "staticHeavy" }],
    },
    // Side-effect import — `import "x"` evaluates the module.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `import "framer-motion"`,
      options: [opts],
      errors: [{ messageId: "staticHeavy", data: { pkg: "framer-motion" } }],
    },
    // Mixed: one inline-typed specifier + one value specifier — still
    // pulls the module's runtime, so the rule must flag it.
    {
      filename: fileIn("src/whatever/foo.ts"),
      code: `import { type Foo, Bar } from "cmdk"`,
      options: [opts],
      errors: [{ messageId: "staticHeavy", data: { pkg: "cmdk" } }],
    },
  ],
})
