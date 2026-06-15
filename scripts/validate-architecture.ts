#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

/**
 * Architecture Validation Script
 *
 * Enforces the project's layered architecture by checking import boundaries
 * (Clean-Architecture-style: each layer has a list of forbidden upstreams).
 *
 * No baseline / no exceptions: every violation must be fixed in the same PR
 * that introduces it. The previous baseline file (`architecture-baseline.json`)
 * was drained to zero and removed.
 *
 * What's checked:
 *   - Static `import ... from "<path>"` statements
 *   - Re-export `export ... from "<path>"` statements
 *   - Both `@/...` alias paths AND relative `./` / `../` paths (the latter
 *     resolved against the current file to catch e.g.
 *     `../../features/maps/UnifiedMap` from a file in `core/`).
 *
 * What's not checked:
 *   - Dynamic `import("...")` calls. Lazy-loaded modules don't create a
 *     compile-time architectural dependency; they're treated as a deliberate
 *     runtime port (see e.g. core/crud/components/BoundaryMap.tsx).
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, "..")
const SRC_DIR = path.join(ROOT_DIR, "src")

// ─── Layer model ─────────────────────────────────────────────────────────────

type Layer = "core" | "domains" | "features" | "infra" | "ui" | "shared" | "app" | "other"

const LAYER_MAP: Record<string, Layer> = {
  core: "core",
  domains: "domains",
  features: "features",
  infra: "infra",
  ui: "ui",
  shared: "shared",
  app: "app",
}

const FORBIDDEN_IMPORTS: Record<Layer, Layer[]> = {
  core: ["domains", "features", "app"],
  domains: ["features", "app"],
  features: ["app"],
  infra: ["domains", "features", "app"],
  ui: ["domains", "features", "infra", "app"],
  shared: ["core", "domains", "features", "infra", "ui", "app"],
  app: [],
  other: [],
}

// ─── Stats ───────────────────────────────────────────────────────────────────

let totalFiles = 0
let newViolations = 0

// ─── Layer detection ─────────────────────────────────────────────────────────

function getLayer(filePath: string): Layer {
  const relativePath = path.relative(SRC_DIR, filePath)
  const parts = relativePath.split(path.sep)
  const topDir = parts[0]
  if (topDir && topDir in LAYER_MAP) return LAYER_MAP[topDir] as Layer
  return "other"
}

/**
 * Resolve an import specifier (alias or relative) to a layer.
 * Returns null if the specifier targets a non-src module (e.g. "react",
 * "lodash", absolute paths).
 */
function getImportLayer(importSpecifier: string, fromFile: string): Layer | null {
  // @-aliased path — read the layer from the first segment after `@/`.
  if (importSpecifier.startsWith("@/")) {
    const parts = importSpecifier.slice(2).split("/")
    const topDir = parts[0]
    if (topDir && topDir in LAYER_MAP) return LAYER_MAP[topDir] as Layer
    return null
  }

  // Relative path — resolve to an absolute path against the importing file,
  // then derive the layer from where it lands inside src/.
  if (importSpecifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(fromFile), importSpecifier)
    const relToSrc = path.relative(SRC_DIR, resolved)
    if (relToSrc.startsWith("..") || path.isAbsolute(relToSrc)) return null
    const topDir = relToSrc.split(path.sep)[0]
    if (topDir && topDir in LAYER_MAP) return LAYER_MAP[topDir] as Layer
    return null
  }

  // Bare specifier (npm package, etc.) — not our concern.
  return null
}

// `apiClient` may be imported only inside `src/infra/` or by service files
// (`*.service.ts(x)?`). Pages, UI components, and non-service hooks must talk
// to the API through a domain or feature service — never axios directly.
function isInfraFile(filePath: string): boolean {
  const relativePath = path.relative(SRC_DIR, filePath)
  return relativePath.split(path.sep)[0] === "infra"
}

function isServiceFile(filePath: string): boolean {
  const base = path.basename(filePath)
  return base.endsWith(".service.ts") || base.endsWith(".service.tsx")
}

const API_CLIENT_IMPORT_RE =
  /import\s+(?:type\s+)?\{[^}]*\bapiClient\b[^}]*\}\s+from\s+['"](@\/infra\/api(?:\/client)?)['"]/g

function checkApiClientImport(filePath: string, content: string): void {
  if (isInfraFile(filePath) || isServiceFile(filePath)) return

  const relFile = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/")
  API_CLIENT_IMPORT_RE.lastIndex = 0
  while (API_CLIENT_IMPORT_RE.exec(content) !== null) {
    console.warn(
      `✗ [Violation] ${relFile}: 'apiClient' may only be imported inside src/infra/ ` +
        `or by *.service.ts(x)? files. Route the call through a domain or feature service.`,
    )
    newViolations++
  }
}

// ─── File scan ───────────────────────────────────────────────────────────────

// Matches both `import ... from "..."` and `export ... from "..."`.
// Doesn't match dynamic `import("...")` (no `from` clause), which is
// intentional — see the file's top-of-module comment.
const STATIC_MODULE_REF_RE = /(?:^|\s)(?:import|export)\s+(?:type\s+)?[^'"]*?\bfrom\s+['"]([^'"]+)['"]/g

function validateFile(filePath: string) {
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) return
  if (filePath.includes("__tests__") || filePath.endsWith(".test.ts")) return

  // Auto-generated entity-config registration is exempt — it imports every
  // entity config and we don't want to enumerate those by hand.
  if (filePath.endsWith("core" + path.sep + "entities" + path.sep + "configs" + path.sep + "init.ts")) return

  totalFiles++
  const content = fs.readFileSync(filePath, "utf8")
  const currentLayer = getLayer(filePath)
  if (currentLayer === "other") return

  // The layer check (forbidden upstream imports) doesn't fire for every layer
  // — `app` and `core` have empty/permissive forbidden lists — but the
  // apiClient-confinement rule applies to every non-infra/non-service file.
  checkApiClientImport(filePath, content)

  const forbidden = FORBIDDEN_IMPORTS[currentLayer]
  if (!forbidden || forbidden.length === 0) return

  STATIC_MODULE_REF_RE.lastIndex = 0
  let match
  while ((match = STATIC_MODULE_REF_RE.exec(content)) !== null) {
    const importPath = match[1]
    if (!importPath) continue

    const targetLayer = getImportLayer(importPath, filePath)
    if (!targetLayer || !forbidden.includes(targetLayer)) continue

    const relFile = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/")
    console.warn(
      `✗ [Violation] ${relFile}: layer '${currentLayer}' cannot import from '${targetLayer}' (${importPath})`,
    )
    newViolations++
  }
}

function walkDir(dir: string) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) walkDir(fullPath)
    else validateFile(fullPath)
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

process.stdout.write("🏗️  Architecture validation: analyzing layer boundaries...\n")
let exitCode = 0

walkDir(SRC_DIR)

if (newViolations > 0) {
  process.stdout.write(`\n✗ Found ${newViolations} architectural violation(s) across ${totalFiles} files.\n`)
  process.stdout.write(`  Fix each violation in code — there is no baseline / no exceptions list.\n`)
  exitCode = 1
}

process.stdout.write(`\n— ${totalFiles} files scanned\n`)

if (exitCode === 0) {
  process.stdout.write("✓ Architecture validation passed.\n")
}
process.exit(exitCode)
