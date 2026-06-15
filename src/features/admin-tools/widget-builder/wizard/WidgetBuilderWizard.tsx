"use client"

/**
 * Top-level widget builder wizard. Permission-gated; mirrors the entity
 * builder's wizard composition so admins can hop between the two without
 * relearning the layout.
 */

import { useRef, useState } from "react"
import { ShieldAlert, LayoutGrid } from "lucide-react"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import type { WidgetBuilderSchema } from "../types/widget-schema"
import { WizardLayout, type WizardStep } from "./WizardLayout"
import { Step1Basics } from "./Step1Basics"
import { Step2DataSource } from "./Step2DataSource"
import { Step3Visualization } from "./Step3Visualization"
import { Step4Preview } from "./Step4Preview"
import { Step5Save } from "./Step5Save"
import { useWidgetWizardState, type WidgetDraft } from "./useWidgetWizardState"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_WIDGET_BUILDER

const STEPS: WizardStep[] = [
  { id: "basics", label: "Basics" },
  { id: "data", label: "Data source" },
  { id: "visualization", label: "Visualization" },
  { id: "preview", label: "Preview" },
  { id: "save", label: "Save" },
]

interface Props {
  prefillSchema?: WidgetBuilderSchema
  mode?: "create" | "update"
}

export function WidgetBuilderWizard({ prefillSchema, mode }: Props = {}): React.ReactNode {
  const { isAdmin, isGranted, isLoading } = usePermissionContext()
  const canEdit = isAdmin || isGranted(MANAGE_PERMISSION)
  const { draft, patch, seed } = useWidgetWizardState()
  const [activeStep, setActiveStep] = useState(0)
  const seededRef = useRef(false)

  if (prefillSchema && !seededRef.current) {
    seededRef.current = true
    seed(prefillSchema)
  }

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>

  if (!canEdit) {
    return (
      <div className="p-12 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <p className="font-semibold">You don&apos;t have permission to use the widget builder.</p>
        <p className="text-xs text-muted-foreground mt-1">Required: {MANAGE_PERMISSION} (or admin role)</p>
      </div>
    )
  }

  return (
    <WizardLayout steps={STEPS} activeStep={activeStep}>
      <header className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{prefillSchema ? "Edit widget" : "New widget"}</h1>
          <p className="text-xs text-muted-foreground">
            Step {activeStep + 1} of {STEPS.length}: {STEPS[activeStep]!.label}
          </p>
        </div>
      </header>

      <ActiveStep
        activeStep={activeStep}
        draft={draft}
        mode={mode ?? (prefillSchema ? "update" : "create")}
        onPatch={patch}
        onSetStep={setActiveStep}
      />
    </WizardLayout>
  )
}

interface ActiveStepProps {
  activeStep: number
  draft: WidgetDraft
  mode: "create" | "update"
  onPatch: (next: WidgetDraft) => void
  onSetStep: (n: number) => void
}

function ActiveStep({ activeStep, draft, mode, onPatch, onSetStep }: ActiveStepProps): React.ReactNode {
  const advance = (n: number) => (next: WidgetDraft) => {
    onPatch(next)
    onSetStep(n)
  }
  const back = (n: number) => () => onSetStep(n)

  switch (activeStep) {
    case 0:
      return <Step1Basics draft={draft} onComplete={advance(1)} />
    case 1:
      return <Step2DataSource draft={draft} onBack={back(0)} onComplete={advance(2)} />
    case 2:
      return <Step3Visualization draft={draft} onBack={back(1)} onComplete={advance(3)} />
    case 3:
      return <Step4Preview draft={draft} onBack={back(2)} onComplete={() => onSetStep(4)} />
    case 4:
      return <Step5Save draft={draft} mode={mode} onBack={back(3)} />
    default:
      return null
  }
}
