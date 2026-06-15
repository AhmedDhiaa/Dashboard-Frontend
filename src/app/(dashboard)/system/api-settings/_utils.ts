import type React from "react"
import {
  Globe,
  Mail,
  KeyRound,
  Lock,
  LogIn,
  UserCog,
  Building2,
  UserCheck,
  Smartphone,
  Truck,
  ShoppingCart,
  CreditCard,
  MessageSquare,
  Cog,
  Package,
} from "lucide-react"
import type { ApiSetting } from "@/shared/types/security.types"

export interface SettingGroupDef {
  key: string
  label: string
  icon: React.ElementType
  prefixes: string[]
}

export const SETTING_GROUPS: SettingGroupDef[] = [
  { key: "localization", label: "Localization & Timing", icon: Globe, prefixes: ["Abp.Localization", "Abp.Timing"] },
  { key: "email", label: "Email & SMTP", icon: Mail, prefixes: ["Abp.Mailing"] },
  { key: "password", label: "Password Policy", icon: KeyRound, prefixes: ["Abp.Identity.Password"] },
  { key: "lockout", label: "Lockout Policy", icon: Lock, prefixes: ["Abp.Identity.Lockout"] },
  { key: "signin", label: "Sign-In Policy", icon: LogIn, prefixes: ["Abp.Identity.SignIn"] },
  { key: "user", label: "User Settings", icon: UserCog, prefixes: ["Abp.Identity.User"] },
  { key: "organization", label: "Organization", icon: Building2, prefixes: ["Abp.Identity.OrganizationUnit"] },
  { key: "account", label: "Account", icon: UserCheck, prefixes: ["Abp.Account"] },
  { key: "otp", label: "One-Time Password", icon: KeyRound, prefixes: ["Api.OneTimePassword"] },
  { key: "system", label: "System Core", icon: Cog, prefixes: ["Api.System"] },
  { key: "mobile-selling", label: "Mobile Selling", icon: ShoppingCart, prefixes: ["Api.Mobile.Selling"] },
  { key: "mobile-customer", label: "Customer App", icon: Smartphone, prefixes: ["Api.Mobile.Customer"] },
  { key: "mobile-driver", label: "Driver App", icon: Truck, prefixes: ["Api.Mobile.Driver"] },
  { key: "payment", label: "Payment", icon: CreditCard, prefixes: ["Api.Integration.Payment"] },
  { key: "sms", label: "SMS Gateway", icon: MessageSquare, prefixes: ["Api.Integration.SMS"] },
  { key: "other", label: "Other", icon: Package, prefixes: [] },
]

export type SettingType = "boolean" | "number" | "url" | "email" | "json" | "text"

export function detectSettingType(name: string, value: string): SettingType {
  if (value.trim().startsWith("{") || name.includes("Integration")) return "json"
  const lower = value.toLowerCase()
  if (lower === "true" || lower === "false") return "boolean"
  if (/^\d+$/.test(value) && value !== "") return "number"
  if (/url/i.test(name) || value.startsWith("http") || value.startsWith("acme://")) return "url"
  if (/email|address/i.test(name) && name.includes("From")) return "email"
  return "text"
}

export function cleanSettingDisplayName(name: string, groupPrefixes: string[]): string {
  let cleaned = name
  for (const prefix of groupPrefixes) {
    if (cleaned.startsWith(prefix + ".")) {
      cleaned = cleaned.slice(prefix.length + 1)
      break
    }
  }
  return cleaned
    .split(".")
    .map(p => p.replace(/([a-z])([A-Z])/g, "$1 $2"))
    .join(" - ")
}

export interface GroupedSettings {
  group: SettingGroupDef
  items: ApiSetting[]
}

export function groupSettings(settings: ApiSetting[]): GroupedSettings[] {
  const assigned = new Set<string>()
  const result: GroupedSettings[] = []

  for (const group of SETTING_GROUPS) {
    if (group.key === "other") continue
    const items = settings.filter(s => {
      if (assigned.has(s.name)) return false
      return group.prefixes.some(p => s.name.startsWith(p))
    })
    items.forEach(s => assigned.add(s.name))
    if (items.length > 0) result.push({ group, items })
  }

  const remaining = settings.filter(s => !assigned.has(s.name))
  if (remaining.length > 0) {
    result.push({ group: SETTING_GROUPS.find(g => g.key === "other")!, items: remaining })
  }
  return result
}
