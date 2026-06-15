/**
 * Mega-page showcase route. Mounts every UI component the system ships
 * with on a single scrollable page so a reviewer can sanity-check the
 * design system in one pass.
 *
 * The actual content lives in AllShowcaseContent — this file is the
 * Next.js entry shell, kept thin to satisfy max-lines-per-page.
 */

import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/ui/layout/PageHeader"
import { Badge } from "@/ui/design-system/primitives/badge"
import { AllShowcaseContent } from "./AllShowcaseContent"

export default async function AllShowcasePage() {
  const t = await getTranslations("showcase")
  return (
    <div className="scroll-smooth">
      <PageHeader
        title={t("page.title")}
        description={t("page.subtitle")}
        badge={<Badge variant="warning">{t("page.dev_only")}</Badge>}
      />
      <AllShowcaseContent />
    </div>
  )
}
