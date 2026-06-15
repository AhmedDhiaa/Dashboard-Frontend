"use client"

import { Download } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"

interface ExportButtonProps {
  locale: string
  overrides: Record<string, string>
  disabled?: boolean
}

export function ExportButton({ locale, overrides, disabled }: ExportButtonProps): React.ReactNode {
  const handleExport = () => {
    const payload = { locale, overrides }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `translations-${locale}-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Button onClick={handleExport} disabled={disabled} variant="outline" className="gap-2">
      <Download className="h-4 w-4" />
      Export JSON
    </Button>
  )
}
