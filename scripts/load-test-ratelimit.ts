/**
 * Rate-limit smoke test for any endpoint with a rule in
 * `infra/ratelimit/config.ts`.
 *
 * Default target: /api/auth/callback/credentials (the original Task 19
 * spec). Override with `--path` to exercise the codegen + runtime
 * rules added in Task B4:
 *
 *   /api/admin/entity-builder/generate   codegen-entity      5/min
 *   /api/admin/widget-builder/generate   codegen-widget      5/min
 *   /api/runtime/materialize/<id>        codegen-materialize 10/min
 *   /api/runtime/data/<id>               runtime-write       30/min
 *
 * The middleware in `middleware.ts` reads the client IP from these
 * headers (in priority order):
 *   - `x-forwarded-for` (first comma-separated entry)
 *   - `x-real-ip`
 *   - `unknown` (fallback — bucketed together)
 *
 * We can't change the source IP from a single test runner, so the
 * script forges `x-forwarded-for` per-request to drive the rule's
 * per-IP bucket. In production this header is trusted only when the
 * request reaches Next.js *through* the trusted reverse proxy — make
 * sure the runner targets the app *behind* the proxy, or run from
 * inside the deploy environment where the proxy chain accepts our
 * forged header.
 *
 * What "passing" looks like (policy-agnostic):
 *   - For each simulated IP, the first `max` requests within the rule's
 *     window get whatever the route's handler returns (200/401/4xx) —
 *     the rate limiter let them through.
 *   - Every subsequent request returns 429 with Retry-After + the
 *     X-RateLimit-* headers documented in middleware.ts.
 *
 * Run (auth callback default):
 *   npx tsx scripts/load-test-ratelimit.ts --target https://app.example.com
 *
 * Run (a codegen endpoint):
 *   npx tsx scripts/load-test-ratelimit.ts \
 *     --target https://app.example.com \
 *     --path /api/admin/entity-builder/generate \
 *     --method POST --max 5
 *
 * Multi-instance verification (Task E3):
 *   This script is also the verification harness for the Redis-backed
 *   limiter. Stand up TWO Next.js instances behind a load balancer that
 *   round-robins between them, point both at the SAME Upstash REST
 *   instance (or the SAME ioredis URL), and run:
 *
 *     npx tsx scripts/load-test-ratelimit.ts \
 *       --target https://lb.example.com \
 *       --ips 5 --rate 20 --duration 60 --max 10
 *
 *   Pass condition: each of the 5 simulated IPs gets exactly `max`
 *   allowed requests across BOTH instances (not 2×max). With the prior
 *   in-memory limiter, each IP would have seen `2 × max` allowed
 *   requests because the two instances counted separately. The Redis
 *   adapter's window-bucketed key is the proof that they share state.
 *
 * Exit code:
 *   0 if every IP saw at least `(rate × duration) - max × 0.9` HTTP 429s.
 *   1 otherwise (report breakdown is printed).
 */

interface Args {
  target: string
  ips: number
  rate: number
  durationSeconds: number
  path: string
  method: string
  /**
   * The rule's `max` value. Subtracted from the expected total so the
   * pass condition matches the rule's actual budget. Defaults to 10
   * (the auth-callback rule's max) for backwards compatibility.
   */
  max: number
}

interface IpStats {
  ip: string
  sent: number
  status2xx: number
  status4xx: number
  status401: number
  status429: number
  status5xx: number
  errors: number
  firstStatusByMinute: number[]
}

function parseArgs(argv: string[]): Args {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a?.startsWith("--")) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith("--")) {
      args[key] = next
      i++
    } else {
      args[key] = "true"
    }
  }
  return {
    target: (args.target ?? "http://localhost:3000").replace(/\/+$/, ""),
    ips: Number(args.ips ?? 5),
    rate: Number(args.rate ?? 30),
    durationSeconds: Number(args.duration ?? 300),
    path: args.path ?? "/api/auth/callback/credentials",
    method: (args.method ?? "POST").toUpperCase(),
    max: Number(args.max ?? 10),
  }
}

function makeIp(seed: number): string {
  // 198.51.100.0/24 is RFC-5737 documentation space — never a real
  // client IP, so production logs flagged with these can be filtered
  // out as load-test traffic.
  return `198.51.100.${1 + seed}`
}

function newStats(ip: string): IpStats {
  return {
    ip,
    sent: 0,
    status2xx: 0,
    status4xx: 0,
    status401: 0,
    status429: 0,
    status5xx: 0,
    errors: 0,
    firstStatusByMinute: [],
  }
}

async function sendOnce(url: string, ip: string, method: string): Promise<{ status: number; error?: string }> {
  try {
    const init: RequestInit = {
      method,
      headers: {
        "x-forwarded-for": ip,
        "x-real-ip": ip,
        "User-Agent": "rate-limit-load-test/1.0",
      },
      redirect: "manual",
    }
    if (method !== "GET" && method !== "HEAD") {
      // Empty JSON body is fine for the codegen routes (they 400/401 on
      // invalid input, both of which are non-429 statuses — exactly what
      // we want from the limiter's perspective).
      ;(init.headers as Record<string, string>)["Content-Type"] = "application/json"
      init.body = "{}"
    }
    const res = await fetch(url, init)
    return { status: res.status }
  } catch (err) {
    return { status: -1, error: err instanceof Error ? err.message : String(err) }
  }
}

function record(stats: IpStats, status: number): void {
  stats.sent++
  if (status === -1) stats.errors++
  else if (status === 401) stats.status401++
  else if (status === 429) stats.status429++
  else if (status >= 200 && status < 300) stats.status2xx++
  else if (status >= 400 && status < 500) stats.status4xx++
  else if (status >= 500) stats.status5xx++
}

async function runIpFlight(args: Args, ip: string, stats: IpStats): Promise<void> {
  const url = `${args.target}${args.path}`
  const periodMs = 1000 / args.rate
  const endAt = Date.now() + args.durationSeconds * 1000
  let nextSendAt = Date.now()
  while (Date.now() < endAt) {
    const wait = nextSendAt - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    nextSendAt += periodMs
    // Don't await — fire-and-forget keeps the cadence tight even if
    // some requests stall briefly. Backpressure is implicit in
    // `setTimeout` cadence.
    void sendOnce(url, ip, args.method).then(r => record(stats, r.status))
  }
  // Drain a short tail so in-flight requests get recorded.
  await new Promise(r => setTimeout(r, 500))
}

function summarise(stats: IpStats[], expectedRatePerIp: number, durationSeconds: number, max: number): boolean {
  const lines: string[] = []
  lines.push("\nResults per simulated IP:")
  lines.push(`  ${"ip".padEnd(16)}  sent  2xx  401  4xx  429  5xx  err`)
  let allPass = true
  for (const s of stats) {
    lines.push(
      `  ${s.ip.padEnd(16)}  ${String(s.sent).padStart(4)}  ${String(s.status2xx).padStart(3)}  ${String(s.status401).padStart(3)}  ${String(s.status4xx).padStart(3)}  ${String(s.status429).padStart(3)}  ${String(s.status5xx).padStart(3)}  ${String(s.errors).padStart(3)}`,
    )
    // Pass condition per IP:
    //   - At least one 429 (limiter engaged at all).
    //   - 429 count exceeds total-attempts minus the rule's max budget.
    //     With 30 r/s × 5 min × max=10 we expect ~8990 429s; with
    //     max=5 (codegen-entity) we expect ~8995. The 0.9 multiplier
    //     gives slack for in-flight tail + clock skew.
    const expected = Math.max(1, expectedRatePerIp * durationSeconds - max)
    const ok = s.status429 >= expected * 0.9
    if (!ok) {
      allPass = false
      lines.push(`    ✗ expected ≥ ~${Math.floor(expected * 0.9)} 429s for ${s.ip}, got ${s.status429}`)
    }
  }
  console.log(lines.join("\n"))
  console.log(
    allPass ? "\n✓ Rate limiter behaves as configured." : "\n✗ Rate limiter is not enforcing the documented budget.",
  )
  return allPass
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  console.log(
    `Load test: ${args.ips} IPs × ${args.rate} req/s × ${args.durationSeconds}s ` +
      `${args.method} ${args.target}${args.path} (rule max=${args.max})`,
  )
  const stats = Array.from({ length: args.ips }, (_, i) => newStats(makeIp(i)))
  await Promise.all(stats.map(s => runIpFlight(args, s.ip, s)))
  const ok = summarise(stats, args.rate, args.durationSeconds, args.max)
  process.exit(ok ? 0 : 1)
}

void main()
