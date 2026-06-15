"use client"

/**
 * HeaderControlButton — the "control panel" button surfaced in the global
 * header. Opens a dropdown with quick actions: jump to each tab of the
 * builder, plus inline export.
 */

import { useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Database,
  Download,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  Settings2,
  Upload,
  Wrench,
} from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/design-system/primitives/dropdown-menu"
import { exportConfig, importConfig, useRuntimeProvider } from "../store"

// eslint-disable-next-line max-lines-per-function -- single dropdown menu, all items inlined
export function HeaderControlButton() {
  const provider = useRuntimeProvider()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const json = exportConfig(provider)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `acme-runtime-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      importConfig(provider, text)
    } catch (err) {
      // Fall back to logging — the more elaborate System panel surfaces
      // detailed errors. The header dropdown is just a quick action.
      console.error("[HeaderControlButton] import failed", err)
    } finally {
      e.target.value = ""
    }
  }

  const handleReset = () => {
    if (window.confirm("Reset all runtime data? This wipes every entity, page, dashboard, and record.")) {
      provider.resetConfig()
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            title="Builder controls"
            className="h-9 w-9 dark:text-white/70 dark:hover:text-white text-muted-foreground hover:text-foreground"
          >
            <Wrench className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Builder</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/builder?tab=entities" className="gap-2">
              <Database className="h-4 w-4" />
              Manage Entities
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/builder?tab=pages" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Manage Pages
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/builder?tab=dashboards" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Manage Dashboards
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/builder?tab=system")} className="gap-2">
            <Settings2 className="h-4 w-4" />
            System
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export config
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick} className="gap-2">
            <Upload className="h-4 w-4" />
            Import config
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleReset}
            className="gap-2 text-destructive focus:text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="h-4 w-4" />
            Reset system
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-[10px] text-muted-foreground gap-2">
            <AlertTriangle className="h-3 w-3" />
            All changes are local to this browser
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
