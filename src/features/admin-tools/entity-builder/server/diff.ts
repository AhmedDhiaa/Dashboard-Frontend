/**
 * Cheap unified-diff renderer for the planned files vs whatever currently
 * exists at their target paths. Used by the wizard's review tab so the
 * admin sees exactly what changes before clicking Generate.
 *
 * Stays dependency-free — the LCS-based diff in `diff` package would be
 * nicer, but a line-by-line compare is enough for the previews the user
 * actually reads. Outputs `--- old / +++ new / @@ context` blocks.
 */

import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"
import path from "node:path"
import type { GeneratedFile } from "./code-generator"

const ROOT = process.cwd()

export interface FileDiff {
  path: string
  status: "new" | "modified" | "unchanged"
  diff: string
}

export async function diffPlannedFiles(files: GeneratedFile[]): Promise<FileDiff[]> {
  const out: FileDiff[] = []
  for (const file of files) {
    const abs = path.resolve(ROOT, file.path)
    if (!existsSync(abs)) {
      out.push({ path: file.path, status: "new", diff: prefixLines(file.content, "+") })
      continue
    }
    const oldContent = await fs.readFile(abs, "utf8")
    if (oldContent === file.content) {
      out.push({ path: file.path, status: "unchanged", diff: "" })
      continue
    }
    out.push({ path: file.path, status: "modified", diff: unifiedDiff(oldContent, file.content) })
  }
  return out
}

function prefixLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map(l => `${prefix}${l}`)
    .join("\n")
}

/**
 * Bare-bones line-by-line diff. Identical adjacent lines are emitted as
 * context, divergent lines as `-old` / `+new`. No move detection, no
 * line-numbering — admins just want to eyeball "what changed".
 */
function unifiedDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const max = Math.max(oldLines.length, newLines.length)
  const lines: string[] = []
  for (let i = 0; i < max; i++) {
    const a = oldLines[i]
    const b = newLines[i]
    if (a === b) {
      if (a !== undefined) lines.push(` ${a}`)
    } else {
      if (a !== undefined) lines.push(`-${a}`)
      if (b !== undefined) lines.push(`+${b}`)
    }
  }
  return lines.join("\n")
}
