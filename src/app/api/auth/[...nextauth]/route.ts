import { handlers } from "@/infra/auth/server"

// Disable static generation for this route to avoid cookie issues
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const { GET, POST } = handlers
