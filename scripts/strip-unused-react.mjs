#!/usr/bin/env node
/**
 * One-shot codemod: removes the unused `React` default import from every file
 * listed in /tmp/files-with-unused-react.txt. Handles two patterns:
 *   - `import React from "react"`                    → delete the line
 *   - `import React, { foo, bar } from "react"`      → `import { foo, bar } from "react"`
 *   - `import React, { type Foo } from "react"`      → `import { type Foo } from "react"`
 */

import { readFileSync, writeFileSync } from "node:fs"

const listFile = process.argv[2]
if (!listFile) {
  console.error("usage: node strip-unused-react.mjs <file-list>")
  process.exit(1)
}

const files = readFileSync(listFile, "utf8")
  .split(/\r?\n/)
  .map(s => s.trim())
  .filter(Boolean)

let changed = 0
for (const file of files) {
  let src
  try {
    src = readFileSync(file, "utf8")
  } catch (e) {
    console.warn(`skip (not found): ${file}`)
    continue
  }

  const before = src

  // import React, { ... } from "react"  →  import { ... } from "react"
  src = src.replace(/^import React,\s*\{([^}]*)\}\s*from\s*["']react["']/m, 'import {$1} from "react"')

  // import React from "react"  →  (delete entire line)
  src = src.replace(/^import React from\s*["']react["']\r?\n?/m, "")

  if (src !== before) {
    writeFileSync(file, src)
    changed++
  }
}

console.log(`updated ${changed} of ${files.length} files`)
