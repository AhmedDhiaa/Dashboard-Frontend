/**
 * Correlation ID generation.
 *
 * A correlation ID is a short, opaque token that uniquely identifies one
 * logical operation as it flows through the stack: client → axios → backend
 * → backend services → logs. When a user reports "I clicked save and it
 * failed," they can quote the ID, and ops can grep across stacks to find
 * the exact request, the exact log lines, and the exact downstream calls.
 *
 * The ID lives in the `x-correlation-id` request header and in every log
 * line emitted on behalf of that request.
 *
 * @module shared/utils/correlation
 */

/**
 * Returns a fresh correlation ID suitable for request tracing.
 *
 * Format: 16 lowercase hex characters (8 bytes of entropy). Short enough to
 * fit in log lines and a user-quoted error message; long enough that
 * collisions are negligible at any plausible request volume.
 *
 * Uses `crypto.getRandomValues` (Web Crypto, available in browsers, Node 19+,
 * and Edge runtime). Falls back to `Math.random()` only in environments
 * without crypto (none of which are realistic for this codebase, but the
 * fallback keeps the function from throwing in unit tests with a stripped
 * globalThis).
 */
export function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("")
  }

  // Last-resort fallback. Not cryptographically strong, but sufficient for a
  // tracing token whose only requirement is uniqueness within an operation
  // window. Should not be reached in production.
  let id = ""
  for (let i = 0; i < 16; i++) id += Math.floor(Math.random() * 16).toString(16)
  return id
}
