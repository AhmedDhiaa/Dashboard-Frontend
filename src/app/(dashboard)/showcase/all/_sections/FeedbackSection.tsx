"use client"

/**
 * FeedbackSection — every async / status / interrupting surface.
 *
 * Covered: Alert (default + destructive), Spinner, LoadingState (sm/md/lg
 * with message), ConfirmDialog, Skeleton primitive, Sheet drawer (the
 * codebase's FilterDrawer is rendered through the Drawer context which a
 * showcase mount can't bootstrap, so we approximate with a Sheet
 * containing the same kind of filter content), and an ErrorBoundary
 * demo with a forced-throw button + outer reset.
 */

import { useState } from "react"
import { AlertTriangle, Filter, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/ui/design-system/primitives/alert"
import { Button } from "@/ui/design-system/primitives/button"
import { ConfirmDialog } from "@/ui/design-system/primitives/ConfirmDialog"
import { LoadingState } from "@/ui/design-system/primitives/LoadingState"
import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { Spinner } from "@/ui/design-system/primitives/Spinner"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/ui/design-system/primitives/sheet"
import { ErrorBoundary } from "@/ui/application/ErrorBoundary"
import ShowcaseBlock from "../_shared/ShowcaseBlock"

export default function FeedbackSection() {
  return (
    <div className="space-y-6">
      <AlertsBlock />
      <SpinnersBlock />
      <LoadingStateBlock />
      <ConfirmDialogBlock />
      <FilterSheetBlock />
      <SkeletonBlock />
      <ErrorBoundaryBlock />
    </div>
  )
}

function AlertsBlock() {
  return (
    <ShowcaseBlock title="Alert variants" description="Default informational + destructive callouts.">
      <div className="space-y-3">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>A neutral informational notice that does not block the user.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Something broke</AlertTitle>
          <AlertDescription>Action couldn’t complete — review the error and retry.</AlertDescription>
        </Alert>
      </div>
    </ShowcaseBlock>
  )
}

function SpinnersBlock() {
  return (
    <ShowcaseBlock title="Spinner" description="Decorative loading indicators at various sizes.">
      <div className="flex items-center gap-6">
        <Spinner size={16} />
        <Spinner size={24} />
        <Spinner size={32} />
        <Spinner size={48} />
      </div>
    </ShowcaseBlock>
  )
}

function LoadingStateBlock() {
  return (
    <ShowcaseBlock title="LoadingState" description="Spinner + optional message at three sizes.">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card/40 p-6">
          <LoadingState size="sm" message="Small" />
        </div>
        <div className="rounded-lg border bg-card/40 p-6">
          <LoadingState size="md" message="Medium" />
        </div>
        <div className="rounded-lg border bg-card/40 p-6">
          <LoadingState size="lg" message="Loading dashboard…" />
        </div>
      </div>
    </ShowcaseBlock>
  )
}

function ConfirmDialogBlock() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const handleConfirm = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    setOpen(false)
  }
  return (
    <ShowcaseBlock title="ConfirmDialog" description="Async-aware destructive confirmation.">
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete record…
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete order ORD-100231?"
        description="This will permanently remove the order and detach its line items."
        confirmText="Delete"
        cancelText="Keep"
        variant="destructive"
        isLoading={loading}
        onConfirm={handleConfirm}
      />
    </ShowcaseBlock>
  )
}

function FilterSheetBlock() {
  return (
    <ShowcaseBlock
      title="Filter sheet"
      description="Drawer-style filter pane (approximation — FilterDrawer needs a context provider)."
    >
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">
            <Filter className="h-4 w-4" />
            Filters (2)
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-96">
          <SheetHeader>
            <SheetTitle>Refine results</SheetTitle>
            <SheetDescription>Adjust filters then apply.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="filter-search">Search term</Label>
              <Input id="filter-search" placeholder="ORD-…" />
            </div>
            <div>
              <Label htmlFor="filter-city">City</Label>
              <Input id="filter-city" placeholder="Type to autocomplete…" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline">Clear</Button>
              <Button>Apply</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </ShowcaseBlock>
  )
}

function SkeletonBlock() {
  return (
    <ShowcaseBlock
      title="Skeleton primitive"
      description="Animated placeholder boxes (build complex skeletons from these)."
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    </ShowcaseBlock>
  )
}

function ErrorBoundaryBlock() {
  const [resetKey, setResetKey] = useState(0)
  return (
    <ShowcaseBlock title="ErrorBoundary" description="Catches render-throws — click Trigger then Reset to remount.">
      <div className="space-y-3">
        <ErrorBoundary key={resetKey}>
          <ErrorTrigger />
        </ErrorBoundary>
        <Button variant="outline" size="sm" onClick={() => setResetKey(k => k + 1)}>
          Reset boundary
        </Button>
      </div>
    </ShowcaseBlock>
  )
}

function ErrorTrigger() {
  const [shouldThrow, setShouldThrow] = useState(false)
  if (shouldThrow) {
    throw new Error("Showcase: forced render-time error")
  }
  return (
    <div className="rounded-md border bg-card/40 p-4 flex items-center justify-between gap-3">
      <p className="text-sm text-foreground">This child renders normally until you press the button.</p>
      <Button variant="destructive" size="sm" onClick={() => setShouldThrow(true)}>
        Trigger error
      </Button>
    </div>
  )
}
