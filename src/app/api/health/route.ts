/**
 * /api/health — readiness probe for orchestrator health checks.
 *
 * Two probes, each with a hard 2-second budget:
 *
 *   - `backend` — GET `${API_URL}/api/abp/application-configuration`. The
 *     ABP config endpoint is reachable without an access token and returns
 *     a stable 200 when the backend is up; a non-2xx response or a timeout
 *     means the BFF can't talk to its upstream and Next should be removed
 *     from the load-balancer pool.
 *   - `storage` — write a randomly-named probe file under
 *     `messages/_overrides/` and immediately unlink it. This exercises the
 *     same volume admin tools mutate (i18n/theme overrides, runtime
 *     config). A read-only mount or filled disk surfaces here before the
 *     first PATCH to /api/i18n/overrides drops a 500 in front of users.
 *
 * Response shape (intentionally narrow, no stack traces / env values):
 *
 *     { status: "ok" | "degraded",
 *       checks: { backend: "ok" | "fail", storage: "ok" | "fail" } }
 *
 * Status code: 200 when both checks are "ok", 503 otherwise. Suitable as
 * the `readinessProbe` in Kubernetes / ECS / a load balancer's HTTP check.
 */

import { promises as fs } from "node:fs"
import { randomBytes } from "node:crypto"
import path from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

const PROBE_TIMEOUT_MS = 2_000
const STORAGE_DIR = path.join(process.cwd(), "messages", "_overrides")

type CheckStatus = "ok" | "fail"

async function probeBackend(): Promise<CheckStatus> {
  // Standalone mock mode has no upstream to reach — every request is answered
  // from seeded in-memory data. Probing `${API_URL}` (a placeholder that
  // points back at this server) would always fail and the readiness probe
  // would 503 forever, pulling the container out of the LB pool on boot.
  // Report "ok" so the documented demo config is actually deployable.
  if (process.env.NEXT_PUBLIC_USE_MOCK_API === "true") return "ok"

  const apiBase = (process.env.API_URL ?? "").replace(/\/+$/, "")
  if (!apiBase) return "fail"
  try {
    const res = await fetch(`${apiBase}/api/abp/application-configuration`, {
      method: "GET",
      // AbortSignal.timeout cancels the request without leaking a setTimeout.
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
      redirect: "manual",
    })
    return res.ok ? "ok" : "fail"
  } catch {
    // Timeout, DNS failure, TCP reset, network-down — all signal the same
    // thing to the load balancer: don't send traffic here right now. The
    // specific cause is in the orchestrator's request log if needed.
    return "fail"
  }
}

async function probeStorage(): Promise<CheckStatus> {
  // Random suffix so concurrent health checks don't collide on the same
  // probe file. Clean-up is unconditional even on partial failure so a
  // crash mid-probe never leaves a stale file behind.
  const probePath = path.join(STORAGE_DIR, `.health-probe-${randomBytes(8).toString("hex")}`)
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
    await fs.writeFile(probePath, "ok")
    await fs.unlink(probePath)
    return "ok"
  } catch {
    // Best-effort cleanup of the probe file if write succeeded but unlink
    // didn't — swallow secondary errors.
    try {
      await fs.unlink(probePath)
    } catch {
      /* ignore */
    }
    return "fail"
  }
}

export async function GET() {
  const [backend, storage] = await Promise.all([probeBackend(), probeStorage()])

  // Readiness gates on `backend` ONLY — that is what determines whether this
  // instance can serve traffic. `storage` is reported but ADVISORY: a hardened
  // read-only-rootfs deploy (k8s `readOnlyRootFilesystem`, or an override volume
  // that isn't mounted) legitimately can't write `messages/_overrides/`, yet the
  // app serves every page fine — only admin i18n/theme override *writes* are
  // unavailable. Failing readiness there would pull a healthy pod from the load
  // balancer. So: backend down → 503 "down"; backend up but storage down →
  // 200 "degraded" (serving, admin-writes disabled); both up → 200 "ok".
  const ready = backend === "ok"
  const status = ready ? (storage === "ok" ? "ok" : "degraded") : "down"

  return NextResponse.json(
    { status, checks: { backend, storage } },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    },
  )
}
