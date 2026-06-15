/**
 * Idempotent, byte-preserving patcher for src/shared/config/navigation.ts.
 *
 * Inserts a new `NavItem` into a specific group's `items: [...]` array.
 * Same text-surgical approach as `permission-keys-patcher.ts` — we never
 * reformat the file, we only splice one new line into the right
 * position. The trade-off: the parser is literal (regex-driven) so a
 * future shape change that breaks the regex anchors will throw
 * `PatchFailedError` rather than silently mis-insert.
 *
 * Two failure modes worth refusing loudly:
 *
 *   - href collision: a navigation entry already exists pointing to the
 *     same href anywhere in the file (any group). We refuse because two
 *     entries with the same href would be impossible for the user to
 *     distinguish in the sidebar.
 *
 *   - missing group: the target group's `titleKey` isn't found. Surface
 *     the available group titleKeys in the error so the admin can pick.
 */

import { promises as fs } from "node:fs"
import path from "node:path"

export class PatchFailedError extends Error {
  constructor(
    message: string,
    public readonly received: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = "PatchFailedError"
  }
}

export class NavHrefCollisionError extends Error {
  constructor(public readonly href: string) {
    super(`A navigation entry already points to "${href}". Refusing to add a duplicate.`)
    this.name = "NavHrefCollisionError"
  }
}

export class NavGroupNotFoundError extends Error {
  constructor(
    public readonly groupTitleKey: string,
    public readonly available: string[],
  ) {
    super(`Navigation group "${groupTitleKey}" not found. Available: ${available.join(", ")}`)
    this.name = "NavGroupNotFoundError"
  }
}

const NAVIGATION_FILE = path.join("src", "shared", "config", "navigation.ts")

/**
 * Constraints mirror the entity-builder schema's identifier shapes so a
 * generated entity's navigation entry CAN be safely interpolated here.
 */
// Accepts `/`, `/single-segment`, `/multi/segment`, `/with?query=1`. Tight
// enough to refuse shell metacharacters; loose enough that the dashboard
// root href is valid (real navigation.ts entries include `href: "/"`).
const HREF_PATTERN = /^\/[a-z0-9/_?=&-]{0,200}$/i
const TITLE_KEY_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/
const ICON_PATTERN = /^[A-Z][A-Za-z0-9]{0,40}$/
const PERMISSION_PATTERN = /^(?:Api\.[A-Z][A-Za-z0-9.]{1,80}|PERMISSIONS\.[A-Z][A-Z0-9_]{0,60})$/

export interface NavPatchInput {
  /** `titleKey` of the existing NavGroup to add the item to (e.g. "nav.inventory"). */
  group: string
  /** Translation key for the new entry's title (e.g. "nav.brands"). */
  titleKey: string
  /** Route href (e.g. "/brands"). */
  href: string
  /**
   * Permission expression to interpolate verbatim. Accepted shapes:
   *
   *   - `Api.Brand`                        — 2-segment prefix (allowed by the lint rule)
   *   - `PERMISSIONS.SOMETHING`            — a reference to permission-keys.ts
   *
   * Anything else throws. The patcher does NOT validate that the
   * `PERMISSIONS.X` reference exists — that's the permission-keys
   * patcher's job. A `npm run type-check` after both patches lands
   * catches a stale reference.
   */
  requiredPermission?: string
  /**
   * Lucide icon name. When provided, the patcher emits `icon: <Name>` and
   * assumes the icon is already imported at the top of navigation.ts.
   * Auto-injecting an import is intentionally out of scope here — the
   * dev has to add the import once per icon name. Surfaces as a `npm
   * run type-check` error if missing.
   */
  icon?: string
}

export interface NavPatchResult {
  content: string
  changed: boolean
  /** What got inserted, for the audit log + UI preview. */
  insertionSnippet?: string
}

function validateInput(input: NavPatchInput): void {
  if (!TITLE_KEY_PATTERN.test(input.group)) {
    throw new PatchFailedError(`group "${input.group}" must be a dotted translation key`)
  }
  if (!TITLE_KEY_PATTERN.test(input.titleKey)) {
    throw new PatchFailedError(`titleKey "${input.titleKey}" must be a dotted translation key`)
  }
  if (!HREF_PATTERN.test(input.href)) {
    throw new PatchFailedError(`href "${input.href}" must be a /path/like-this`)
  }
  if (input.requiredPermission !== undefined && !PERMISSION_PATTERN.test(input.requiredPermission)) {
    throw new PatchFailedError(
      `requiredPermission "${input.requiredPermission}" must be a quoted "Api.X" prefix or a PERMISSIONS.X reference`,
    )
  }
  if (input.icon !== undefined && !ICON_PATTERN.test(input.icon)) {
    throw new PatchFailedError(`icon "${input.icon}" must be a PascalCase lucide name`)
  }
}

/**
 * Find every existing `href: "..."` literal in the file. Refusing to
 * insert a duplicate href is one of the spec's safety gates.
 */
function existingHrefs(source: string): Set<string> {
  const set = new Set<string>()
  const re = /\bhref:\s*"([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) set.add(m[1]!)
  return set
}

/**
 * Find every `titleKey: "X"` literal at the top level of a group object
 * — we use these as anchors when locating the right group's items[].
 */
function existingGroupTitleKeys(source: string): string[] {
  // Match `titleKey: "X"` lines that are followed (within 6 lines) by an
  // `items:` opener — that disambiguates groups from individual nav items
  // which also have a titleKey field.
  const lines = source.split("\n")
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*titleKey:\s*"([^"]+)",/.exec(lines[i]!)
    if (!m) continue
    for (let j = i + 1; j < Math.min(i + 7, lines.length); j++) {
      if (/^\s*items:\s*\[/.test(lines[j]!)) {
        out.push(m[1]!)
        break
      }
    }
  }
  return out
}

/**
 * Locate the `items: [` line for the group whose titleKey matches AND
 * its matching closing `]` line. The closing line is the one whose
 * indentation matches the opener, capping the array body.
 *
 * We don't try to parse nested arrays — `subItems: [...]` is fine as
 * long as it lives on its own (multi-line) entry block, which the
 * existing file does.
 */
function findGroupItemsRange(
  source: string,
  groupTitleKey: string,
): { itemsOpenLine: number; itemsCloseLine: number; itemIndent: string } | null {
  const lines = source.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)titleKey:\s*"([^"]+)",/.exec(lines[i]!)
    if (!m || m[2] !== groupTitleKey) continue
    // Find `items: [` in the next 10 lines.
    let openLine = -1
    let openIndent = ""
    for (let j = i + 1; j < Math.min(i + 11, lines.length); j++) {
      const om = /^(\s*)items:\s*\[\s*$/.exec(lines[j]!)
      if (om) {
        openLine = j
        openIndent = om[1]!
        break
      }
    }
    if (openLine < 0) continue
    // Find matching `]` — first line with EXACTLY the same indent as the
    // opener and starting with `]`.
    for (let j = openLine + 1; j < lines.length; j++) {
      if (lines[j] === `${openIndent}],` || lines[j] === `${openIndent}]`) {
        return {
          itemsOpenLine: openLine,
          itemsCloseLine: j,
          itemIndent: `${openIndent}  `,
        }
      }
    }
  }
  return null
}

/** Build the one-line entry literal. */
function buildEntryLine(input: NavPatchInput, indent: string): string {
  const parts: string[] = [`titleKey: "${input.titleKey}"`, `href: "${input.href}"`]
  if (input.requiredPermission !== undefined) {
    // PERMISSIONS.X is an unquoted reference; Api.X is a quoted literal.
    // Both are emitted verbatim — input was already validated.
    const ref = input.requiredPermission.startsWith("PERMISSIONS.")
      ? input.requiredPermission
      : `"${input.requiredPermission}"`
    parts.push(`requiredPermission: ${ref}`)
  }
  if (input.icon !== undefined) parts.push(`icon: ${input.icon}`)
  return `${indent}{ ${parts.join(", ")} },`
}

export function applyNavigationPatch(source: string, input: NavPatchInput): NavPatchResult {
  validateInput(input)

  // Idempotent: if some entry with the same href already exists, no-op
  // when it's in the requested group, refuse otherwise (the spec calls
  // for collision refusal). We use the simpler "exists anywhere → refuse"
  // rule because two entries with the same href, even in different
  // groups, would be impossible to distinguish in the sidebar.
  const hrefs = existingHrefs(source)
  if (hrefs.has(input.href)) {
    // Same href, same group, same titleKey? → true no-op. Otherwise refuse.
    const existingLineRe = new RegExp(
      `^\\s*\\{[^}]*titleKey:\\s*"${input.titleKey}"[^}]*href:\\s*"${input.href}"[^}]*\\},\\s*$`,
      "m",
    )
    if (existingLineRe.test(source)) {
      return { content: source, changed: false }
    }
    throw new NavHrefCollisionError(input.href)
  }

  const range = findGroupItemsRange(source, input.group)
  if (!range) {
    throw new NavGroupNotFoundError(input.group, existingGroupTitleKeys(source))
  }

  const entryLine = buildEntryLine(input, range.itemIndent)
  const lines = source.split("\n")
  lines.splice(range.itemsCloseLine, 0, entryLine)
  return { content: lines.join("\n"), changed: true, insertionSnippet: entryLine.trim() }
}

function resolveTarget(repoRoot: string): string {
  const abs = path.resolve(repoRoot, NAVIGATION_FILE)
  const expected = path.resolve(repoRoot, "src", "shared", "config", "navigation.ts")
  if (abs !== expected) {
    throw new PatchFailedError(`resolved path ${abs} does not match expected ${expected}`)
  }
  return abs
}

export async function readNavigationFile(repoRoot: string = process.cwd()): Promise<string> {
  return await fs.readFile(resolveTarget(repoRoot), "utf8")
}

export async function writeNavigationFile(content: string, repoRoot: string = process.cwd()): Promise<void> {
  await fs.writeFile(resolveTarget(repoRoot), content, "utf8")
}

export const NAVIGATION_PATH = NAVIGATION_FILE
