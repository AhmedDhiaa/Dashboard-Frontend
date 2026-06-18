#!/usr/bin/env node
/**
 * Serve the Next.js **standalone** build for the functional E2E suite — the same
 * artifact that ships to production, so the suite exercises pre-built (not
 * dev-compiled) chunks. Standalone output omits `static`/`public`; we copy them
 * next to `server.js`, then start it. The (mock) build must already exist:
 *   npm run e2e:prod:build
 *
 * Runtime env (PORT, AUTH_SECRET, NEXTAUTH_URL …) comes from Playwright's
 * `webServer.env`; the mock flag is baked at build time (NEXT_PUBLIC_*).
 */

import { cpSync, existsSync } from "node:fs"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const STANDALONE = path.join(ROOT, ".next", "standalone")
const SERVER = path.join(STANDALONE, "server.js")

if (!existsSync(SERVER)) {
  console.error("[e2e-prod] .next/standalone/server.js missing — build first:\n  npm run e2e:prod:build")
  process.exit(1)
}

// Stage the assets the standalone server expects beside it.
cpSync(path.join(ROOT, ".next", "static"), path.join(STANDALONE, ".next", "static"), { recursive: true })
if (existsSync(path.join(ROOT, "public"))) {
  cpSync(path.join(ROOT, "public"), path.join(STANDALONE, "public"), { recursive: true })
}

const child = spawn(process.execPath, [SERVER], { cwd: STANDALONE, env: { ...process.env }, stdio: "inherit" })
child.on("exit", code => process.exit(code ?? 0))
