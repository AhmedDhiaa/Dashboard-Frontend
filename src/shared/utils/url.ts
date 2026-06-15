/**
 * URL and Path Utilities — security-critical path sanitization.
 *
 * `getSafePath` defends the application against open-redirect attacks. Any
 * place that takes a user-supplied `redirectTo` / `callbackUrl` query
 * parameter and forwards the user there (login flows, session-expired flows,
 * forbidden-page redirects) MUST run the value through `getSafePath` first.
 *
 * Threat model:
 *   - Phishing link `?redirectTo=//evil.tk/login` after auth → browser
 *     interprets `//evil.tk/login` as protocol-relative and lands the user on
 *     evil.tk. We must NOT pass that through.
 *   - URL-encoded variants of the above: `%2F%2Fevil.tk`, `%5C%5Cevil.tk`.
 *   - Backslash variants: `/\evil.tk` (some clients normalize to `//`).
 *   - Control-character injection: `/foo\nbar`.
 *   - Long-string DoS: defensive length cap before any work.
 *
 * Policy: deny-by-default. The result is always either the unchanged input
 * (when it's a strict same-origin relative path) or the safe fallback `"/"`.
 * No "extract path from full URL" cleverness — that was the previous
 * implementation's footgun, and TLD-based hostname allowlists trail the
 * times (any new TLD slips through). If a caller has a full URL on its
 * hands, the right thing is to reject and bail out.
 *
 * @module shared/utils/url
 */

// Allowed characters in a same-origin path:
//   - alphanumerics
//   - unreserved punctuation: `-`, `.`, `_`, `~`
//   - structural separators: `/`, `?`, `&`, `=`, `#`
//   - pct-encoding: `%`
// Notably absent: `\`, `:`, `;`, space, control chars, `<>'"` — anything that
// would turn a path into something else (URL components, scripts, etc.).
const SAFE_PATH_CHARS = /^\/[A-Za-z0-9\-._~/?&=%#]*$/

// Defensive: large inputs are almost certainly attacker payloads, not real
// app paths. The longest legitimate path in this codebase is well under 200.
const MAX_PATH_LENGTH = 500

/**
 * Returns the input if and only if it is a strict same-origin relative path.
 * Any other shape — full URL, protocol-relative `//`, backslash, control
 * char, disallowed punctuation, or excessive length — collapses to `"/"`.
 *
 * @example
 * getSafePath("/dashboard")              // → "/dashboard"
 * getSafePath("/orders/abc-123?tab=x")    // → "/orders/abc-123?tab=x"
 * getSafePath("//evil.tk/login")          // → "/"   (open-redirect attempt)
 * getSafePath("http://app.com/dashboard") // → "/"   (full URL — caller bug)
 * getSafePath("/\\evil.tk")               // → "/"   (backslash variant)
 * getSafePath("%2F%2Fevil.tk")            // → "/"   (decodes to "//evil.tk")
 * getSafePath("/foo\nbar")                // → "/"   (control char)
 * getSafePath(null)                       // → "/"
 */
export function getSafePath(path: string | null | undefined): string {
  if (typeof path !== "string" || path.length === 0) return "/"
  if (path.length > MAX_PATH_LENGTH) return "/"

  // Decode pct-escapes once so attacker-encoded prefixes like `%2F%2Fevil.tk`
  // don't slip through the textual checks below. Malformed encoding → reject.
  let candidate: string
  try {
    candidate = decodeURIComponent(path)
  } catch {
    return "/"
  }

  // Re-check length: pct-decode can shrink slightly but a clever payload
  // could still hit the cap.
  if (candidate.length > MAX_PATH_LENGTH) return "/"

  // The path must begin with exactly one `/`. Reject `//` (protocol-relative
  // — the canonical open-redirect form) and `/\` (backslash variants that
  // some URL parsers normalize to `//`).
  if (!candidate.startsWith("/")) return "/"
  if (candidate.length > 1) {
    const second = candidate[1]
    if (second === "/" || second === "\\") return "/"
  }

  // Final allowlist gate — anything not in SAFE_PATH_CHARS (including
  // backslash anywhere, colons, control chars, whitespace) collapses.
  if (!SAFE_PATH_CHARS.test(candidate)) return "/"

  return candidate
}
