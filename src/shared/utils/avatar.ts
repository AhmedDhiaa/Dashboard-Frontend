/**
 * Avatar helpers — initials extraction and deterministic color assignment.
 * Lives in `shared/` because both `features/chat` and `domains/tickets`
 * render avatars; placing it under either would force a cross-feature/domain
 * import.
 */

export function getInitials(name: string): string {
  if (!name || name === "Unknown User" || name === "Unknown") return "?"
  return name
    .trim()
    .split(/\s+/)
    .map(n => n[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const AVATAR_COLORS = [
  "bg-gradient-to-br from-blue-500 to-blue-600",
  "bg-gradient-to-br from-purple-500 to-purple-600",
  "bg-gradient-to-br from-pink-500 to-pink-600",
  "bg-gradient-to-br from-green-500 to-green-600",
  "bg-gradient-to-br from-orange-500 to-orange-600",
  "bg-gradient-to-br from-teal-500 to-teal-600",
] as const

export function getAvatarColor(senderId: string): string {
  if (!senderId) return AVATAR_COLORS[0]
  const hash = senderId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}
