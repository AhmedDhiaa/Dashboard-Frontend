/**
 * REST adapter transport.
 *
 * A deliberately tiny `fetch` wrapper for a conventional JSON REST backend
 * (json-server / Express style). It is the ONLY place the REST backend's base
 * URL and bearer-token convention are named — exactly the role `apiClient` plays
 * for ABP. Uses the global `fetch`, so unit tests stub it with no network.
 *
 * Token: the app wires `setRestTokenProvider` to its session (see the composition
 * root / docs). Defaults to no token, which is all the public auth endpoints and
 * the contract tests need.
 */

export interface RestResponse<T> {
  data: T
  headers: Headers
}

type TokenProvider = () => string | null | Promise<string | null>

let tokenProvider: TokenProvider = () => null

/** Wire the bearer token source (e.g. the NextAuth session) for authed calls. */
export function setRestTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_REST_API_URL ?? "").replace(/\/$/, "")
}

export async function restFetch<T>(path: string, init: RequestInit = {}): Promise<RestResponse<T>> {
  const token = await tokenProvider()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers })
  if (!res.ok) {
    throw new Error(`REST ${init.method ?? "GET"} ${path} → ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  return { data: (text ? JSON.parse(text) : undefined) as T, headers: res.headers }
}
