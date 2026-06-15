/**
 * Accessibility smoke tests for every primitive in the design system.
 *
 * Each test renders the primitive in a representative configuration
 * (label associations, button roles, focusable elements, etc.) and runs
 * axe-core against the resulting DOM. The matcher is registered globally
 * by `src/shared/test-utils/setup.ts`, so individual files just call
 * `expect(container).toHaveNoViolations()`.
 *
 * Why one file, not 30+
 * ---------------------
 * Each scenario is a few lines of JSX; consolidating keeps the harness
 * (theme provider wrapping, label-association helpers) in one place.
 * The describe-block names map 1:1 to primitive files so grep still
 * works for "where do we test the alert primitive?".
 *
 * What we deliberately don't assert
 * ---------------------------------
 *   - Color contrast: jsdom doesn't run our Tailwind CSS, so axe's color
 *     checks will report against unstyled defaults. We disable that rule.
 *   - region landmark: axe wants every page to have a landmark; primitive
 *     specimens are not pages. Disabled.
 *   - Portals: dialogs / popovers render into document.body when opened.
 *     We only test the resting (closed) state for primitives whose open
 *     state requires a portal — opening would require waiting for a Radix
 *     animation frame and isn't useful for static a11y validation.
 */

import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { axe } from "vitest-axe"
import type { ReactElement } from "react"

import { ThemeProvider } from "@/ui/theme/ThemeManager"

import { Alert, AlertTitle, AlertDescription } from "../alert"
import { Avatar, AvatarFallback, AvatarImage } from "../avatar"
import { Badge } from "../badge"
import { Breadcrumbs } from "../breadcrumbs"
import { Button } from "../button"
import { Calendar } from "../calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../card"
import { Checkbox } from "../checkbox"
import { ConfirmDialog } from "../ConfirmDialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../dropdown-menu"
import { IconWrapper } from "../icon-wrapper"
import { Input } from "../input"
import { Label } from "../label"
import { LoadingState } from "../LoadingState"
import { Popover, PopoverContent, PopoverTrigger } from "../popover"
import { RadioGroup, RadioGroupItem } from "../radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select"
import { Separator } from "../separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../sheet"
import { Skeleton } from "../skeleton"
import { Slider } from "../slider"
import { Spinner } from "../Spinner"
import { StatCard } from "../stat-card"
import { Switch } from "../switch"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "../table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs"
import { TextGradient } from "../text-gradient"
import { Textarea } from "../textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip"
import { CheckCircle, Home as HomeIcon } from "lucide-react"

// ─── Harness ─────────────────────────────────────────────────────────────────

// Disable rules that require a real layout / CSS pipeline that jsdom can't
// supply, plus rules that don't apply to isolated primitive specimens.
const AXE_OPTIONS = {
  rules: {
    "color-contrast": { enabled: false },
    region: { enabled: false },
  },
}

function withTheme(ui: ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>
}

async function expectClean(ui: ReactElement) {
  const { container } = render(withTheme(ui))
  const results = await axe(container, AXE_OPTIONS)
  expect(results).toHaveNoViolations()
}

// ─── Per-primitive specimens ─────────────────────────────────────────────────

// One describe block lists every primitive — keeping each `it` inline
// makes the suite easy to read top-to-bottom. The container is long by
// design (~30 cases), so `max-lines-per-function` is suppressed locally.
// eslint-disable-next-line max-lines-per-function
describe("primitives accessibility (axe)", () => {
  it("alert renders with title + description", async () => {
    await expectClean(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>This is an alert.</AlertDescription>
      </Alert>,
    )
  })

  it("alert-dialog renders trigger (closed state)", async () => {
    await expectClean(
      <AlertDialog>
        <AlertDialogTrigger>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action is destructive.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    )
  })

  it("avatar renders with image + fallback", async () => {
    await expectClean(
      <Avatar>
        <AvatarImage src="" alt="User profile picture" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    )
  })

  it("badge renders with text", async () => {
    await expectClean(<Badge>New</Badge>)
  })

  it("breadcrumbs render with items", async () => {
    await expectClean(
      <Breadcrumbs
        items={[
          { title: "Orders", href: "/orders" },
          { title: "#1234", active: true },
        ]}
      />,
    )
  })

  it("button renders with accessible name", async () => {
    await expectClean(<Button>Save</Button>)
  })

  it("calendar renders", async () => {
    await expectClean(<Calendar mode="single" />)
  })

  it("card renders with header + content", async () => {
    await expectClean(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    )
  })

  it("checkbox renders with label", async () => {
    await expectClean(
      <div className="flex items-center gap-2">
        <Checkbox id="terms" />
        <Label htmlFor="terms">Accept terms</Label>
      </div>,
    )
  })

  it("ConfirmDialog renders (closed state)", async () => {
    // ConfirmDialog returns no portal content when `open=false`; the
    // rendered tree is empty, which axe accepts.
    await expectClean(
      <ConfirmDialog
        open={false}
        onOpenChange={() => undefined}
        onConfirm={() => undefined}
        title="Confirm"
        description="Proceed?"
      />,
    )
  })

  it("dialog renders trigger (closed state)", async () => {
    await expectClean(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Heading</DialogTitle>
            <DialogDescription>Body</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    )
  })

  it("dropdown-menu renders trigger (closed state)", async () => {
    await expectClean(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
  })

  it("icon-wrapper renders with an aria-hidden lucide icon", async () => {
    await expectClean(<IconWrapper icon={CheckCircle} />)
  })

  it("input renders with associated label", async () => {
    await expectClean(
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" />
      </div>,
    )
  })

  it("label renders associated with a field", async () => {
    await expectClean(
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" />
      </div>,
    )
  })

  it("LoadingState renders an accessible spinner", async () => {
    await expectClean(<LoadingState />)
  })

  it("popover renders trigger (closed state)", async () => {
    await expectClean(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>,
    )
  })

  it("radio-group renders with labelled items", async () => {
    await expectClean(
      <RadioGroup defaultValue="a">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="a" id="a" />
          <Label htmlFor="a">Option A</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="b" id="b" />
          <Label htmlFor="b">Option B</Label>
        </div>
      </RadioGroup>,
    )
  })

  it("select renders with placeholder (closed state)", async () => {
    await expectClean(
      <div>
        <Label htmlFor="country">Country</Label>
        <Select>
          <SelectTrigger id="country">
            <SelectValue placeholder="Pick a country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="iq">Iraq</SelectItem>
            <SelectItem value="sa">Saudi Arabia</SelectItem>
          </SelectContent>
        </Select>
      </div>,
    )
  })

  it("separator renders", async () => {
    await expectClean(<Separator />)
  })

  it("sheet renders trigger (closed state)", async () => {
    await expectClean(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Title</SheetTitle>
            <SheetDescription>Body</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    )
  })

  it("skeleton renders as a decorative element", async () => {
    await expectClean(<Skeleton className="h-4 w-32" />)
  })

  it("slider renders with an accessible label", async () => {
    // Radix Slider's accessible name lives on its inner thumb span, so the
    // label has to be passed via aria-label/aria-labelledby — htmlFor on a
    // wrapping <Label> won't reach the thumb.
    await expectClean(
      <div>
        <Label htmlFor="vol" id="vol-label">
          Volume
        </Label>
        <Slider id="vol" defaultValue={[50]} aria-labelledby="vol-label" />
      </div>,
    )
  })

  it("Spinner renders an accessible spinner", async () => {
    // Decorative spinner; axe should accept the SVG as-is.
    await expectClean(<Spinner />)
  })

  it("stat-card renders", async () => {
    await expectClean(<StatCard title="Orders" value={42} icon={HomeIcon} />)
  })

  it("switch renders with associated label", async () => {
    await expectClean(
      <div className="flex items-center gap-2">
        <Switch id="notifications" />
        <Label htmlFor="notifications">Notifications</Label>
      </div>,
    )
  })

  it("table renders with headers + rows", async () => {
    await expectClean(
      <Table>
        <TableCaption>Orders</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>ORD-1</TableCell>
            <TableCell>Pending</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
  })

  it("tabs render with active panel", async () => {
    await expectClean(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    )
  })

  it("text-gradient renders text", async () => {
    await expectClean(<TextGradient>Hello world</TextGradient>)
  })

  it("textarea renders with associated label", async () => {
    await expectClean(
      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" />
      </div>,
    )
  })

  it("tooltip renders trigger (closed state)", async () => {
    await expectClean(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Help</Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    )
  })
})
