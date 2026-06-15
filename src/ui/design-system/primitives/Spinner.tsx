"use client"

import React from "react"
import { cn } from "@/shared/utils"

type SpinnerProps = {
  size?: number // optional size in px
  className?: string
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 24, className }) => {
  return (
    <div
      className={cn("animate-spin rounded-full border-4 border-t-primary border-muted", className)}
      style={{ width: size, height: size }}
    />
  )
}
