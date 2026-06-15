#!/usr/bin/env node
/**
 * Cross-platform publish packager.
 *
 * Produces a single, portable deploy bundle from the Next.js standalone output
 * that runs ANYWHERE a Node 22 runtime exists — Linux, Windows, macOS, IIS,
 * Docker, a bare VM, PaaS — with no build step on the target. The bundle is:
 *
 *   publish/
 *     server.js            ← Next standalone server entry (`node server.js`)
 *     node_modules/        ← only the production deps Next traced
 *     .next/static/        ← hashed client assets
 *     public/              ← static files
 *     web.config           ← IIS / Azure App Service (Windows)
 *     deploy/              ← start scripts + systemd/PM2/nginx configs + runbook
 *     .env.example         ← copy to .env and fill in
 *     publish.json         ← build manifest (name, version, node, builtAt)
 *
 * It also writes `dist/<name>-<version>.tar.gz` (extractable on Linux, macOS,
 * and Windows 10+, which ship bsdtar).
 *
 * Usage:
 *   node scripts/publish.mjs              # full: next build + package
 *   node scripts/publish.mjs --skip-build # package an existing .next build (CI)
 */

import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs"
import { execSync } from "node:child_process"
import path from "node:path"

const ROOT = process.cwd()
const STAGE = path.join(ROOT, "publish")
const DIST = path.join(ROOT, "dist")
const STANDALONE = path.join(ROOT, ".next", "standalone")
const skipBuild = process.argv.includes("--skip-build")

const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"))
const name = pkg.name || "app"
const version = pkg.version || "0.0.0"

const log = msg => console.log(`[publish] ${msg}`)
const copyIf = (from, to) => {
  if (existsSync(from)) cpSync(from, to, { recursive: true })
}

// 1. Build (unless the caller already produced .next, e.g. in CI).
if (!skipBuild) {
  log("building production app (npm run build)…")
  execSync("npm run build", { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } })
}

// 2. Verify the standalone output exists.
if (!existsSync(path.join(STANDALONE, "server.js"))) {
  console.error(
    "[publish] .next/standalone/server.js not found.\n" +
      "          Run `npm run build` first, or drop --skip-build so this script builds for you.\n" +
      "          (Requires `output: \"standalone\"` in next.config.ts — already set.)",
  )
  process.exit(1)
}

// 3. Assemble the portable bundle.
log("assembling portable bundle → ./publish")
rmSync(STAGE, { recursive: true, force: true })
mkdirSync(STAGE, { recursive: true })

cpSync(STANDALONE, STAGE, { recursive: true }) // server.js + traced node_modules + .next server chunks
cpSync(path.join(ROOT, ".next", "static"), path.join(STAGE, ".next", "static"), { recursive: true })
copyIf(path.join(ROOT, "public"), path.join(STAGE, "public"))
copyIf(path.join(ROOT, "deploy"), path.join(STAGE, "deploy"))
copyIf(path.join(ROOT, "deploy", "windows", "web.config"), path.join(STAGE, "web.config"))
copyIf(path.join(ROOT, ".env.example"), path.join(STAGE, ".env.example"))

writeFileSync(
  path.join(STAGE, "publish.json"),
  JSON.stringify({ name, version, node: ">=22", entry: "server.js", builtAt: new Date().toISOString() }, null, 2) + "\n",
)

// 4. Archive (bsdtar ships on Linux, macOS, and Windows 10+).
// Use forward-slash RELATIVE paths with cwd=ROOT so GNU tar on Windows/Git Bash
// doesn't mistake a `D:\...` path for a remote `host:path` (the colon trips it).
mkdirSync(DIST, { recursive: true })
rmSync(path.join(DIST, `${name}-${version}.tar.gz`), { force: true })
const archiveRel = `dist/${name}-${version}.tar.gz`
try {
  execSync(`tar -czf "${archiveRel}" -C publish .`, { stdio: "inherit", cwd: ROOT })
  log(`archive → ${archiveRel}`)
} catch {
  log("`tar` unavailable — the ./publish folder is ready; compress it with any tool to ship it.")
}

log("done.")
log("Deploy: extract the bundle on the target, then —")
log("  Linux/macOS : cd publish && NODE_ENV=production node server.js   (or use deploy/linux, deploy/pm2)")
log("  Windows     : cd publish ; $env:NODE_ENV='production'; node server.js   (or deploy/windows, IIS web.config)")
