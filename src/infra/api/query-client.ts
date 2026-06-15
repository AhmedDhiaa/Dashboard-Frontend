import { QueryClient } from "@tanstack/react-query"

/**
 * Factory for the app's TanStack Query client.
 *
 * Defaults tuned for an admin dashboard backed by ABP:
 *  - `staleTime: 30s` — list data is considered fresh for half a minute, so
 *    navigating away and back doesn't refetch immediately (dedup + snappier).
 *  - `refetchOnWindowFocus: false` — an operator tabbing back shouldn't trigger
 *    a surprise reload mid-task; mutations + manual refresh drive freshness.
 *  - `retry: 1` — one retry smooths transient blips without hammering a 4xx.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Don't retry auth/permission/not-found — they're not transient, so a
        // retry only delays the error (and the kept-alive previous data) by a
        // round-trip. Other failures get up to 2 retries.
        retry: (failureCount, error) => {
          const status = (error as { response?: { status?: number } } | null)?.response?.status
          if (status === 401 || status === 403 || status === 404) return false
          return failureCount < 2
        },
      },
    },
  })
}
