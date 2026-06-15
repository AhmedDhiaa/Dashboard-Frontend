"use client"

import { useState, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { makeQueryClient } from "./query-client"

/**
 * Mounts the TanStack Query client for the client tree. The client is created
 * once per browser session via useState (not at module scope) so it isn't
 * shared across SSR requests.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient)
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
