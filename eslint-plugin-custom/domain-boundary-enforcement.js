/**
 * ESLint rule: domain-boundary-enforcement
 *
 * Enforces feature-domain isolation across the entire src/features/ tree.
 *
 * Configuration model
 * -------------------
 * Each entry under `src/features/<name>/` is one of two kinds:
 *
 *   - DOMAIN: an isolated business feature. May not import from another domain.
 *     May not import from `@/app/`. May import from `@/ui/` and from
 *     declared SHARED_LIBRARIES.
 *
 *   - SHARED LIBRARY: a feature whose surface is intentionally exposed to
 *     every other feature (e.g. the maps widget set, used by orders, kpis,
 *     tracking, work-sessions). Listed explicitly so adding a new shared
 *     library is a deliberate decision, not an accidental import.
 *
 * Rules enforced (when the file under analysis is inside a DOMAIN):
 *   - import from @/app/<anything>   →  appImportViolation
 *   - import from @/features/<other-domain>/<anything>  →  crossDomainViolation
 *   - import from @/features/<this-domain>/<anything>   →  allowed (intra-domain)
 *   - import from @/features/<shared-library>/<anything>  →  allowed
 *
 * NOT enforced (yet):
 *   - The previous version forbade `@/ui/` imports as a TODO. We continue to
 *     allow them for now; tightening that would create hundreds of violations
 *     and warrants its own task.
 *   - The previous version checked that domain imports go through `index.ts`.
 *     That path is also unenforced — same reason.
 *
 * Where the previous version went wrong: it only listed `tracking` and
 * `chat` as domains. The other 7 features in `src/features/` (chat,
 * dashboard, kpis, navigation, orders, settings, work-sessions, maps) had
 * no awareness in the rule, so cross-imports between them passed silently.
 */

"use strict"

// All feature subfolders that are isolated domains (no cross-imports).
const DOMAINS = {
  "admin-tools":   { paths: ["src/features/admin-tools"] },
  chat:            { paths: ["src/features/chat"] },
  dashboard:       { paths: ["src/features/dashboard"] },
  kpis:            { paths: ["src/features/kpis"] },
  navigation:      { paths: ["src/features/navigation"] },
  orders:          { paths: ["src/features/orders"] },
  settings:        { paths: ["src/features/settings"] },
  tracking:        { paths: ["src/features/tracking"] },
  "work-sessions": { paths: ["src/features/work-sessions"] },
}

// Features that are shared across every domain. Add only when the shared
// nature is intentional and reviewed.
const SHARED_LIBRARIES = {
  maps: { paths: ["src/features/maps"] },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findOwner(filename, table) {
  // ESLint gives us OS-native paths; normalize to forward slashes for matching.
  const normalized = filename.replace(/\\/g, "/")
  for (const [name, entry] of Object.entries(table)) {
    for (const p of entry.paths) {
      if (normalized.includes(`/${p}/`) || normalized.endsWith(`/${p}`)) return name
    }
  }
  return null
}

function importTargetsFeature(importPath, table) {
  for (const [name, entry] of Object.entries(table)) {
    for (const p of entry.paths) {
      const alias = p.replace(/^src\//, "@/")
      if (importPath === alias || importPath.startsWith(`${alias}/`)) return name
    }
  }
  return null
}

function isAppImport(importPath) {
  return importPath === "@/app" || importPath.startsWith("@/app/")
}

// ─── Rule ───────────────────────────────────────────────────────────────────

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce isolation between feature domains under src/features/",
      category: "Architecture",
      recommended: true,
    },
    messages: {
      appImportViolation:
        'Domain "{{domain}}" cannot import from @/app/. Move shared logic into the appropriate layer (ui/, infra/, shared/).',
      crossDomainViolation:
        'Domain "{{domain}}" cannot import from sibling domain "{{targetDomain}}". Domains under src/features/ must be isolated. Move the shared piece into @/ui/ or @/shared/, or — if the import is genuinely shared — promote the source folder to a SHARED_LIBRARIES entry in the rule.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename()
    const currentDomain = findOwner(filename, DOMAINS)

    // The rule only watches files inside a domain. Files in shared libraries
    // (e.g. inside src/features/maps/) are not subject to isolation; they are
    // the thing being imported, not the importer.
    if (!currentDomain) return {}

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value
        if (typeof importPath !== "string") return
        // Relative imports stay within the same folder; trust them.
        if (importPath.startsWith(".")) return

        if (isAppImport(importPath)) {
          context.report({ node, messageId: "appImportViolation", data: { domain: currentDomain } })
          return
        }

        const targetDomain = importTargetsFeature(importPath, DOMAINS)
        if (targetDomain && targetDomain !== currentDomain) {
          context.report({
            node,
            messageId: "crossDomainViolation",
            data: { domain: currentDomain, targetDomain },
          })
          return
        }

        // Imports into SHARED_LIBRARIES (and anywhere outside src/features/)
        // are allowed. Intra-domain imports are also allowed.
      },
    }
  },
}
