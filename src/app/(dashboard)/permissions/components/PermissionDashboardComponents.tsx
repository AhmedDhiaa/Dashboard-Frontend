"use client"

import { Shield, Users, Settings, ArrowRight, UserCheck, Info, LucideIcon } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"

export const SECTIONS = [
  {
    titleKey: "nav.roles",
    descKey: "pages.role.description",
    descFallback: "Manage role-based permissions for system-wide access control.",
    icon: Shield,
    href: "/roles",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    titleKey: "nav.users",
    descKey: "pages.user.description",
    descFallback: "Assign user-specific permission overrides.",
    icon: Users,
    href: "/users",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    titleKey: "nav.settings",
    descKey: "settings.description",
    descFallback: "Configure security policies and system-wide settings.",
    icon: Settings,
    href: "/settings/security",
    color: "text-secondary",
    bgColor: "bg-secondary/10",
  },
]

interface SectionCardProps {
  section: {
    titleKey: string
    descKey: string
    descFallback: string
    icon: LucideIcon
    href: string
    color: string
    bgColor: string
  }
  t: (k: string) => string
}

export function SectionCard({ section, t }: SectionCardProps) {
  return (
    <Link href={section.href}>
      <Card className="h-full rounded-xl border border-border bg-card hover:border-primary/50 transition-colors group cursor-pointer">
        <CardHeader className="pb-3">
          <div className={`p-2.5 rounded-xl w-fit ${section.bgColor} mb-3`}>
            <section.icon className={`h-5 w-5 ${section.color}`} />
          </div>
          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors flex items-center justify-between">
            {t(section.titleKey) || section.titleKey}
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity rtl:rotate-180" />
          </CardTitle>
          <CardDescription className="text-sm line-clamp-2">
            {t(section.descKey) || section.descFallback}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            {t("common.manage") || "Manage"}
            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}

export function TipCards({ t }: { t: (k: string) => string }) {
  return (
    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="p-5 rounded-xl bg-muted/40 border border-border">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          {t("pages.security_tip") || "Security Tip"}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("pages.security_tip_text") ||
            "Always prefer Role-based permissions over User-based ones. Assigning permissions to roles makes it easier to manage large teams and ensures consistency across the organization."}
        </p>
      </div>
      <div className="p-5 rounded-xl bg-muted/40 border border-border">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          {t("pages.audit_info") || "Audit Logs"}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("pages.audit_info_text") ||
            "The system tracks all permission changes. You can review audit logs to see who granted or revoked permissions and when."}
        </p>
      </div>
    </div>
  )
}
