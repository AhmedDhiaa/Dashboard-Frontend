/**
 * Plop generator config.
 *
 * Generators:
 *   - entity     scaffolds a new domain entity (schema/types/service/config + 3 dashboard pages)
 *   - feature    scaffolds a new src/features/<name>/ shell + registers it in the eslint domain table
 *   - component  scaffolds a UI component into one of the canonical UI buckets
 *   - hook       scaffolds a shared hook + appends to the hooks barrel
 *
 * After every generator run we shell out to `npm run init-entities`
 * (regenerates the entity-config registry) and `eslint --fix` (cleans up
 * formatting on the freshly-written files).
 */

import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import type { NodePlopAPI, ActionType } from "plop"

const ROOT = process.cwd()
const FEATURE_BUCKETS = ["primitives", "application", "crud", "data-table", "layout", "skeletons"] as const

// Track files created during a run so the post-gen lint-fix only touches them.
const createdFiles: string[] = []

function trackCreated(targetPath: string): void {
  createdFiles.push(path.resolve(ROOT, targetPath))
}

/**
 * Reduce a route input to the leaf segment.
 *
 * The user can type the route as `/customers`, `customers`, or
 * `\customers`. On Git Bash (Windows) the shell silently rewrites a
 * leading `/` into a Windows path before plop sees the argument
 * (`/customers` → `C:/Program Files/Git/customers`). We can't trust the
 * incoming string to be path-shaped — only the last segment is reliable.
 */
function normalizeRouteFolder(raw: string): string {
  const segments = String(raw)
    .split(/[\\/]+/)
    .filter(Boolean)
  return segments[segments.length - 1] || ""
}

// ─── i18n appender (custom action) ──────────────────────────────────────────
//
// Mutates messages/{en,ar}/pages.json by adding a new top-level entry keyed
// by the entity name. Uses real JSON parse/stringify rather than regex
// against the file body — JSON edits via regex are how generators silently
// produce broken output.
function appendPagesJson(locale: "en" | "ar", entityKey: string, singular: string, plural: string): string {
  const filePath = path.join(ROOT, "messages", locale, "pages.json")
  const raw = fs.readFileSync(filePath, "utf8")
  const json = JSON.parse(raw) as Record<string, unknown>

  if (json[entityKey]) {
    return `messages/${locale}/pages.json: key "${entityKey}" already present, skipped`
  }

  json[entityKey] = {
    title: plural,
    name: singular,
    description: `Manage ${plural.toLowerCase()}`,
    searchPlaceholder: `Search ${plural.toLowerCase()}...`,
    detail_title: `${singular} Details`,
    create_title: `Create ${singular}`,
    edit_title: `Edit ${singular}`,
    info_title: `${singular} Information`,
    info_description: `Enter basic ${singular.toLowerCase()} details`,
  }

  // 4-space indent matches the existing pages.json files in this repo.
  fs.writeFileSync(filePath, JSON.stringify(json, null, 4) + "\n")
  return `messages/${locale}/pages.json: added "${entityKey}"`
}

// ─── Post-gen: regenerate entity init + lint-fix only what we wrote ──────────
function runPostGen(): string {
  const lines: string[] = []
  try {
    execSync("npm run init-entities", { cwd: ROOT, stdio: "pipe" })
    lines.push("init-entities: ok")
  } catch (err) {
    const e = err as { stderr?: Buffer; stdout?: Buffer }
    lines.push(`init-entities: FAILED — ${(e.stderr ?? e.stdout ?? Buffer.from("")).toString().slice(0, 400)}`)
  }

  if (createdFiles.length === 0) {
    lines.push("lint-fix: no created files to lint")
  } else {
    const unique = Array.from(new Set(createdFiles)).filter(p => /\.(ts|tsx|mjs|js)$/.test(p) && fs.existsSync(p))
    if (unique.length === 0) {
      lines.push("lint-fix: no lintable files")
    } else {
      try {
        execSync(`npx eslint --fix ${unique.map(f => `"${f}"`).join(" ")}`, { cwd: ROOT, stdio: "pipe" })
        lines.push(`lint-fix: ok (${unique.length} files)`)
      } catch (err) {
        const e = err as { stderr?: Buffer; stdout?: Buffer }
        lines.push(`lint-fix: warnings — ${(e.stderr ?? e.stdout ?? Buffer.from("")).toString().slice(0, 400)}`)
      }
    }
  }

  // Reset for the next run within the same plop process.
  createdFiles.length = 0
  return lines.join("\n  ")
}

// ─── Generator setup ────────────────────────────────────────────────────────

export default function setup(plop: NodePlopAPI): void {
  // Helper: pre-render a templated path with the answers so we can track
  // the file we're about to write. Used to feed the post-gen lint-fix list.
  function trackTemplatedPath(template: string, answers: Record<string, unknown>): void {
    const rendered = plop.renderString(template, answers)
    trackCreated(rendered)
  }

  // ── entity ────────────────────────────────────────────────────────────────
  plop.setGenerator("entity", {
    description: "Scaffold a domain entity (schema, types, service, config + dashboard pages)",
    prompts: [
      { type: "input", name: "name", message: "Singular name (e.g. 'Customer'):" },
      { type: "input", name: "namePlural", message: "Plural name (e.g. 'Customers'):" },
      {
        type: "input",
        name: "routePath",
        message: "Dashboard route path (e.g. '/customers'):",
        default: (a: { namePlural?: string }) => (a.namePlural ? `/${plop.getHelper("kebabCase")(a.namePlural)}` : ""),
      },
      { type: "confirm", name: "bilingual", message: "Add bilingual foreignName field?", default: true },
      { type: "confirm", name: "withStatus", message: "Add isActive status field?", default: true },
      { type: "confirm", name: "withAudit", message: "Include audit metadata in detail view?", default: true },
      {
        type: "input",
        name: "area",
        message: "Domain area (e.g. 'business', 'geography', 'system'):",
        default: "business",
      },
    ],
    actions: (answers): ActionType[] => {
      if (!answers) return []
      const a = answers as Record<string, string | boolean>
      const routeFolder = normalizeRouteFolder(String(a.routePath))
      a.routeFolder = routeFolder
      // Re-canonicalise routePath so the entity config's basePath isn't a
      // Git-Bash-mangled Windows path (`C:/Program Files/Git/customers`).
      a.routePath = `/${routeFolder}`
      a.entityKey = plop.getHelper("camelCase")(String(a.name))
      a.permissionKey = `Api.${plop.getHelper("pascalCase")(String(a.name))}`

      const baseDir = `src/domains/{{kebabCase area}}/{{kebabCase name}}`
      const pageDir = `src/app/(dashboard)/${routeFolder}`

      // Track files for post-gen lint-fix.
      for (const tail of [
        `${baseDir}/{{kebabCase name}}.types.ts`,
        `${baseDir}/{{kebabCase name}}.schema.ts`,
        `${baseDir}/{{kebabCase name}}.service.ts`,
        `${baseDir}/{{kebabCase name}}.config.ts`,
        `${pageDir}/page.tsx`,
        `${pageDir}/[id]/page.tsx`,
        `${pageDir}/[id]/edit/page.tsx`,
      ]) {
        trackTemplatedPath(tail, a)
      }

      return [
        {
          type: "add",
          path: `${baseDir}/{{kebabCase name}}.types.ts`,
          templateFile: "plop-templates/entity-types.hbs",
        },
        {
          type: "add",
          path: `${baseDir}/{{kebabCase name}}.schema.ts`,
          templateFile: "plop-templates/entity-schema.hbs",
        },
        {
          type: "add",
          path: `${baseDir}/{{kebabCase name}}.service.ts`,
          templateFile: "plop-templates/entity-service.hbs",
        },
        {
          type: "add",
          path: `${baseDir}/{{kebabCase name}}.config.ts`,
          templateFile: "plop-templates/entity-config.hbs",
        },
        {
          type: "add",
          path: `${pageDir}/page.tsx`,
          templateFile: "plop-templates/page-list.hbs",
        },
        {
          type: "add",
          path: `${pageDir}/[id]/page.tsx`,
          templateFile: "plop-templates/page-detail.hbs",
        },
        {
          type: "add",
          path: `${pageDir}/[id]/edit/page.tsx`,
          templateFile: "plop-templates/page-edit.hbs",
        },
        () => appendPagesJson("en", String(a.entityKey), String(a.name), String(a.namePlural)),
        () => appendPagesJson("ar", String(a.entityKey), String(a.name), String(a.namePlural)),
        () => `post-gen:\n  ${runPostGen()}`,
      ]
    },
  })

  // ── feature ──────────────────────────────────────────────────────────────
  plop.setGenerator("feature", {
    description: "Scaffold a feature module (src/features/<name>/) and register it as an isolated domain",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Feature name (kebab-case, e.g. 'inventory-reports'):",
      },
    ],
    actions: (answers): ActionType[] => {
      if (!answers) return []
      const a = answers as Record<string, string>
      const baseDir = `src/features/{{kebabCase name}}`

      for (const tail of [`${baseDir}/index.ts`, `${baseDir}/types.ts`]) {
        trackTemplatedPath(tail, a)
      }

      return [
        {
          type: "add",
          path: `${baseDir}/index.ts`,
          templateFile: "plop-templates/feature-index.hbs",
        },
        {
          type: "add",
          path: `${baseDir}/types.ts`,
          templateFile: "plop-templates/feature-types.hbs",
        },
        {
          type: "add",
          path: `${baseDir}/components/.gitkeep`,
          template: "",
        },
        {
          type: "add",
          path: `${baseDir}/hooks/.gitkeep`,
          template: "",
        },
        {
          type: "add",
          path: `${baseDir}/services/.gitkeep`,
          template: "",
        },
        {
          type: "modify",
          path: "eslint-plugin-custom/domain-boundary-enforcement.js",
          // Inject before the closing `}` of the DOMAINS table.
          // Anchor: the `// Features that are shared` comment that follows.
          pattern: /(const DOMAINS = \{[\s\S]*?)(\n\}\s*\n\s*\/\/ Features that are shared)/,
          template: `$1\n  "${plop.getHelper("kebabCase")(a.name)}": { paths: ["src/features/${plop.getHelper("kebabCase")(a.name)}"] },$2`,
        },
        () => `post-gen:\n  ${runPostGen()}`,
      ]
    },
  })

  // ── component ────────────────────────────────────────────────────────────
  plop.setGenerator("component", {
    description: "Scaffold a UI component into a canonical bucket",
    prompts: [
      { type: "input", name: "name", message: "Component name (PascalCase):" },
      {
        type: "list",
        name: "bucket",
        message: "Bucket:",
        choices: FEATURE_BUCKETS as unknown as string[],
        default: "application",
      },
    ],
    actions: (answers): ActionType[] => {
      if (!answers) return []
      const a = answers as Record<string, string>
      trackTemplatedPath("src/ui/{{bucket}}/{{pascalCase name}}.tsx", a)
      return [
        {
          type: "add",
          path: "src/ui/{{bucket}}/{{pascalCase name}}.tsx",
          templateFile: "plop-templates/component.hbs",
        },
        () => `post-gen:\n  ${runPostGen()}`,
      ]
    },
  })

  // ── hook ─────────────────────────────────────────────────────────────────
  plop.setGenerator("hook", {
    description: "Scaffold a shared hook (without the leading 'use')",
    prompts: [{ type: "input", name: "name", message: "Hook name (without 'use' prefix):" }],
    actions: (answers): ActionType[] => {
      if (!answers) return []
      const a = answers as Record<string, string>
      trackTemplatedPath("src/shared/hooks/use{{pascalCase name}}.ts", a)
      return [
        {
          type: "add",
          path: "src/shared/hooks/use{{pascalCase name}}.ts",
          templateFile: "plop-templates/hook.hbs",
        },
        {
          type: "append",
          path: "src/shared/hooks/index.ts",
          template: 'export * from "./use{{pascalCase name}}"',
        },
        () => `post-gen:\n  ${runPostGen()}`,
      ]
    },
  })
}
