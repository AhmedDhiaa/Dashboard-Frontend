import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import React from "react"
import type { ComponentType } from "react"
import type { DataTableProps } from "./DataTable"

export const LazyDataTable = dynamic(() => import("./DataTable").then(mod => ({ default: mod.DataTable })), {
  loading: () => {
    return React.createElement(
      "div",
      { className: "flex items-center justify-center p-8" },
      React.createElement(Loader2, { className: "h-8 w-8 animate-spin text-muted-foreground" }),
    )
  },
  ssr: false,
}) as ComponentType<DataTableProps<Record<string, unknown>, unknown>>
