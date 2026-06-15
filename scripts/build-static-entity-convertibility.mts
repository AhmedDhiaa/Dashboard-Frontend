/**
 * Regenerate `docs/static-entity-convertibility.md` from the current state
 * of `src/domains/`. Run via:
 *
 *     npx tsx scripts/build-static-entity-convertibility.mts
 *
 * Committed alongside the parser so reviewers can see at a glance which
 * entities the convert flow accepts (and why the rest refuse).
 */

import { promises as fs } from "node:fs"
import path from "node:path"
import {
  buildConvertibilityReport,
  renderConvertibilityMarkdown,
} from "../src/features/admin-tools/entity-converter/server/parse-static-config"

async function main(): Promise<void> {
  const repoRoot = process.cwd()
  const rows = await buildConvertibilityReport({ repoRoot })
  const md = renderConvertibilityMarkdown(rows)
  const outPath = path.join(repoRoot, "docs", "static-entity-convertibility.md")
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, md)
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outPath} (${rows.filter(r => r.ok).length}/${rows.length} convertible)`)
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
