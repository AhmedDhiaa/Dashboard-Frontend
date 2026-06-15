"use client"

import { Check } from "lucide-react"
import { cn } from "@/shared/utils"

export interface WizardStep {
  id: string
  label: string
}

interface WizardLayoutProps {
  steps: WizardStep[]
  activeStep: number
  children: React.ReactNode
}

export function WizardLayout({ steps, activeStep, children }: WizardLayoutProps): React.ReactNode {
  return (
    <div className="p-6 space-y-6">
      <ol className="flex items-center gap-2 flex-wrap">
        {steps.map((step, i) => {
          const done = i < activeStep
          const current = i === activeStep
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
                current && "border-primary bg-primary/10 text-primary",
                done && "border-primary bg-primary text-primary-foreground",
                !current && !done && "border-border text-muted-foreground",
              )}
            >
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-background text-foreground border border-border text-[10px]">
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {step.label}
            </li>
          )
        })}
      </ol>
      {children}
    </div>
  )
}
