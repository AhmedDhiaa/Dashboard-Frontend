"use client"

/**
 * Permissions Dashboard Page
 * High-level overview linking to Role/User permission management and security settings.
 */

import { Key } from "lucide-react"
import { useT } from "@/shared/config"
import { styles } from "@/ui/utils"
import { SECTIONS, SectionCard, TipCards } from "./components/PermissionDashboardComponents"

export default function PermissionsPage() {
  const t = useT()
  return (
    <div className={styles.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Key className="h-6 w-6 text-primary" />
          </div>
          {t("nav.permissions") || "Permissions"}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {t("pages.permissions_overview") ||
            "Manage system-wide permissions, access levels, and security configurations. Select a provider below to manage specific access rights."}
        </p>
      </div>
      <div className={styles.grid3}>
        {SECTIONS.map(s => (
          <SectionCard key={s.href} section={s} t={t} />
        ))}
      </div>
      <TipCards t={t} />
    </div>
  )
}
