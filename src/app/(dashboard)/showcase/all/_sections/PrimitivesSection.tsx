"use client"

/**
 * PrimitivesSection — covers every component under
 * `@/ui/design-system/primitives` that renders standalone (i.e. doesn't
 * need a form context).
 *
 * Covered: Button (variants, sizes, with-icon, loading, disabled), Badge,
 * Card, Alert, Avatar, Tabs, Tooltip, Dialog, DropdownMenu, Popover, Sheet,
 * Command (inline), Breadcrumbs, Separator, IconWrapper, TextGradient,
 * StatCard, Calendar.
 *
 * Note: an "accordion" primitive doesn't exist under design-system —
 * the only accordion in the codebase is the page-builder block schema —
 * so it isn't demoed here.
 */

import { useState } from "react"
import { Bell, Check, Download, Info, Mail, MoreHorizontal, Plus, Settings, Star, User } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/ui/design-system/primitives/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/design-system/primitives/avatar"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Breadcrumbs } from "@/ui/design-system/primitives/breadcrumbs"
import { Button } from "@/ui/design-system/primitives/button"
import { Calendar } from "@/ui/design-system/primitives/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/design-system/primitives/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/design-system/primitives/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/design-system/primitives/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/design-system/primitives/dropdown-menu"
import { IconWrapper } from "@/ui/design-system/primitives/icon-wrapper"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/design-system/primitives/popover"
import { Separator } from "@/ui/design-system/primitives/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/ui/design-system/primitives/sheet"
import { StatCard } from "@/ui/design-system/primitives/stat-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/design-system/primitives/tabs"
import { TextGradient } from "@/ui/design-system/primitives/text-gradient"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/design-system/primitives/tooltip"
import ShowcaseBlock from "../_shared/ShowcaseBlock"
import { MOCK_STATS, MOCK_PEOPLE } from "../_shared/mock-data"

const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "success",
  "warning",
  "link",
] as const
const BUTTON_SIZES = ["sm", "default", "lg"] as const
const BADGE_VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "success",
  "warning",
  "info",
  "accent",
  "muted",
] as const

export default function PrimitivesSection() {
  return (
    <div className="space-y-6">
      <ButtonsBlock />
      <BadgesBlock />
      <CardsBlock />
      <AlertsBlock />
      <AvatarsBlock />
      <TabsBlock />
      <TooltipBlock />
      <DialogBlock />
      <DropdownBlock />
      <PopoverBlock />
      <SheetBlock />
      <CommandBlock />
      <BreadcrumbsBlock />
      <SeparatorBlock />
      <IconWrapperBlock />
      <TextGradientBlock />
      <StatCardBlock />
      <CalendarBlock />
    </div>
  )
}

function ButtonsBlock() {
  return (
    <ShowcaseBlock title="Button" description="All variants, sizes, with icon, loading, and disabled states.">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {BUTTON_VARIANTS.map(v => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_SIZES.map(s => (
            <Button key={s} size={s}>
              Size {s}
            </Button>
          ))}
          <Button size="icon" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button>
            <Plus className="h-4 w-4" />
            With icon
          </Button>
          <Button loading>Loading…</Button>
          <Button disabled>Disabled</Button>
          <Button variant="outline" disabled>
            Outline disabled
          </Button>
        </div>
      </div>
    </ShowcaseBlock>
  )
}

function BadgesBlock() {
  return (
    <ShowcaseBlock title="Badge" description="All semantic variants.">
      <div className="flex flex-wrap gap-2">
        {BADGE_VARIANTS.map(v => (
          <Badge key={v} variant={v} className="capitalize">
            {v}
          </Badge>
        ))}
      </div>
    </ShowcaseBlock>
  )
}

function CardsBlock() {
  return (
    <ShowcaseBlock title="Card" description="Composable card with header, content, and footer.">
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Card title</CardTitle>
          <CardDescription>Short description of what this card is about.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            Body content sits here. Cards compose freely with any layout primitive.
          </p>
        </CardContent>
        <CardFooter className="gap-2">
          <Button size="sm">Confirm</Button>
          <Button size="sm" variant="outline">
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </ShowcaseBlock>
  )
}

function AlertsBlock() {
  return (
    <ShowcaseBlock title="Alert" description="Inline message variants.">
      <div className="space-y-3">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Default alert</AlertTitle>
          <AlertDescription>A neutral message — informational only.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>Destructive alert</AlertTitle>
          <AlertDescription>Something went wrong — review and retry.</AlertDescription>
        </Alert>
      </div>
    </ShowcaseBlock>
  )
}

function AvatarsBlock() {
  return (
    <ShowcaseBlock title="Avatar" description="With image, fallback, and grouped.">
      <div className="flex items-center gap-4">
        {MOCK_PEOPLE.slice(0, 4).map(person => (
          <Avatar key={person.id}>
            <AvatarImage src="" alt={person.name} />
            <AvatarFallback>{person.initials}</AvatarFallback>
          </Avatar>
        ))}
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {MOCK_PEOPLE.map(person => (
            <Avatar key={person.id} className="border-2 border-card">
              <AvatarFallback>{person.initials}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
    </ShowcaseBlock>
  )
}

function TabsBlock() {
  return (
    <ShowcaseBlock title="Tabs" description="Multi-panel selector.">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4 text-sm">
          Overview panel — high-level summary.
        </TabsContent>
        <TabsContent value="activity" className="pt-4 text-sm">
          Activity panel — recent events log.
        </TabsContent>
        <TabsContent value="settings" className="pt-4 text-sm">
          Settings panel — per-section configuration.
        </TabsContent>
      </Tabs>
    </ShowcaseBlock>
  )
}

function TooltipBlock() {
  return (
    <ShowcaseBlock title="Tooltip" description="Hover/focus-revealed hints.">
      <TooltipProvider>
        <div className="flex gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Help">
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>What this button does</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">
                <Star className="h-4 w-4" /> Favourite
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add to favourites</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </ShowcaseBlock>
  )
}

function DialogBlock() {
  const [open, setOpen] = useState(false)
  return (
    <ShowcaseBlock title="Dialog" description="Modal content surface.">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm action</DialogTitle>
            <DialogDescription>This is a demo dialog — nothing destructive will happen.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Dialog body. Use this for medium-complexity confirmations and short forms.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>
              <Check className="h-4 w-4" />
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ShowcaseBlock>
  )
}

function DropdownBlock() {
  return (
    <ShowcaseBlock title="DropdownMenu" description="Action menu with items, separator, and label.">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <MoreHorizontal className="h-4 w-4" />
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="h-4 w-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Download className="h-4 w-4" /> Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ShowcaseBlock>
  )
}

function PopoverBlock() {
  return (
    <ShowcaseBlock title="Popover" description="Floating content anchored to a trigger.">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Open popover</Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-2">
          <h4 className="text-sm font-medium">Notifications</h4>
          <p className="text-xs text-muted-foreground">
            Use popovers for ephemeral controls — filters, settings, quick previews.
          </p>
          <Button size="sm" variant="outline">
            Manage
          </Button>
        </PopoverContent>
      </Popover>
    </ShowcaseBlock>
  )
}

function SheetBlock() {
  return (
    <ShowcaseBlock title="Sheet" description="Edge-anchored drawer surface.">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Open sheet</Button>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Sheet content scrolls independently of the page.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3 text-sm">
            <p>Sheets work well for filter sidebars, detail-edit panes, and long forms.</p>
          </div>
        </SheetContent>
      </Sheet>
    </ShowcaseBlock>
  )
}

function CommandBlock() {
  return (
    <ShowcaseBlock title="Command" description="cmdk-powered inline command palette.">
      <Command className="rounded-lg border max-w-md">
        <CommandInput placeholder="Type a command…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem>
              <Mail className="h-4 w-4" /> Send a message
            </CommandItem>
            <CommandItem>
              <Bell className="h-4 w-4" /> Notifications
            </CommandItem>
            <CommandItem>
              <Settings className="h-4 w-4" /> Settings
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </ShowcaseBlock>
  )
}

function BreadcrumbsBlock() {
  return (
    <ShowcaseBlock title="Breadcrumbs" description="Navigation trail with leading Home anchor.">
      <Breadcrumbs
        items={[
          { title: "Orders", href: "/orders" },
          { title: "ORD-100231", active: true },
        ]}
      />
    </ShowcaseBlock>
  )
}

function SeparatorBlock() {
  return (
    <ShowcaseBlock title="Separator" description="Horizontal and vertical dividers.">
      <div className="space-y-3">
        <div>Section A</div>
        <Separator />
        <div>Section B</div>
        <div className="flex h-12 items-center gap-3 text-sm">
          <span>Left</span>
          <Separator orientation="vertical" />
          <span>Middle</span>
          <Separator orientation="vertical" />
          <span>Right</span>
        </div>
      </div>
    </ShowcaseBlock>
  )
}

function IconWrapperBlock() {
  return (
    <ShowcaseBlock title="IconWrapper" description="Iconographic accent containers.">
      <div className="flex flex-wrap gap-4">
        {(["primary", "accent", "success", "warning", "danger"] as const).map(variant => (
          <IconWrapper key={variant} icon={Star} variant={variant} />
        ))}
      </div>
    </ShowcaseBlock>
  )
}

function TextGradientBlock() {
  return (
    <ShowcaseBlock title="TextGradient" description="Gradient-fill display text.">
      <div className="space-y-2">
        <TextGradient variant="primary" as="h3" className="text-3xl font-bold">
          Primary gradient
        </TextGradient>
        <TextGradient variant="accent" as="h3" className="text-3xl font-bold">
          Accent gradient
        </TextGradient>
        <TextGradient variant="success" as="h3" className="text-3xl font-bold">
          Success gradient
        </TextGradient>
      </div>
    </ShowcaseBlock>
  )
}

function StatCardBlock() {
  return (
    <ShowcaseBlock title="StatCard" description="KPI surface with icon, value, and trend.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_STATS.map((s, i) => (
          <StatCard
            key={s.title}
            title={s.title}
            value={s.value}
            description={s.description}
            icon={[Bell, Star, User, Settings][i]}
            trend={"trend" in s && s.trend ? { value: s.trend.value, isPositive: s.trend.isPositive } : undefined}
            variant={(["primary", "accent", "success", "warning"] as const)[i % 4]}
          />
        ))}
      </div>
    </ShowcaseBlock>
  )
}

function CalendarBlock() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  return (
    <ShowcaseBlock title="Calendar" description="Single-date picker.">
      <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border w-fit" />
    </ShowcaseBlock>
  )
}
