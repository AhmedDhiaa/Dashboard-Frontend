"use client"

import { useState } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { Badge } from "@/ui/design-system/primitives/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/ui/design-system/primitives/card"
import { Alert, AlertDescription, AlertTitle } from "@/ui/design-system/primitives/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/design-system/primitives/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/design-system/primitives/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/design-system/primitives/tooltip"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/design-system/primitives/dropdown-menu"
import { Info, AlertTriangle, CheckCircle2, XCircle, ChevronDown, User, Settings, LogOut } from "lucide-react"

function ShowcaseBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="rounded-lg border bg-card p-6">{children}</div>
    </div>
  )
}

export function ComponentsContent() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <Tabs defaultValue="buttons">
      <TabsList className="flex-wrap h-auto gap-1">
        {(["buttons", "badges", "cards", "alerts", "dialogs", "dropdowns", "avatars"] as const).map(s => (
          <TabsTrigger key={s} value={s} className="capitalize">
            {s}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="buttons" className="space-y-6 pt-4">
        <ShowcaseBlock title="Variants">
          <div className="flex flex-wrap gap-3">
            {(["primary", "secondary", "outline", "ghost", "destructive", "success", "warning", "link"] as const).map(
              v => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ),
            )}
          </div>
        </ShowcaseBlock>
        <ShowcaseBlock title="Sizes">
          <div className="flex flex-wrap items-center gap-3">
            {(["sm", "default", "lg"] as const).map(s => (
              <Button key={s} size={s}>
                Size {s}
              </Button>
            ))}
            <Button size="icon" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </ShowcaseBlock>
        <ShowcaseBlock title="States">
          <div className="flex flex-wrap gap-3">
            <Button loading>Saving...</Button>
            <Button disabled>Disabled</Button>
          </div>
        </ShowcaseBlock>
      </TabsContent>

      <TabsContent value="badges" className="space-y-6 pt-4">
        <ShowcaseBlock title="Variants">
          <div className="flex flex-wrap gap-3">
            {(["default", "secondary", "outline", "success", "warning", "destructive", "info", "muted"] as const).map(
              v => (
                <Badge key={v} variant={v}>
                  {v}
                </Badge>
              ),
            )}
          </div>
        </ShowcaseBlock>
      </TabsContent>

      <TabsContent value="cards" className="space-y-6 pt-4">
        <ShowcaseBlock title="Card Anatomy">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description text</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Card body content.</p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
                <Button size="sm">Confirm</Button>
              </CardFooter>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-primary">Accent Card</CardTitle>
                <CardDescription>With custom border and background</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Highlighted information.</p>
              </CardContent>
            </Card>
          </div>
        </ShowcaseBlock>
      </TabsContent>

      <TabsContent value="alerts" className="space-y-4 pt-4">
        {(
          [
            { variant: "default", icon: Info, title: "Info", desc: "Informational message." },
            { variant: "success", icon: CheckCircle2, title: "Success", desc: "Operation completed." },
            { variant: "warning", icon: AlertTriangle, title: "Warning", desc: "Review before continuing." },
            { variant: "destructive", icon: XCircle, title: "Error", desc: "Something went wrong." },
          ] as const
        ).map(({ variant, icon: Icon, title, desc }) => (
          <Alert key={variant} variant={variant}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{desc}</AlertDescription>
          </Alert>
        ))}
      </TabsContent>

      <TabsContent value="dialogs" className="pt-4">
        <ShowcaseBlock title="Dialog">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog Title</DialogTitle>
                <DialogDescription>This is the dialog description.</DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">Dialog body content.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ShowcaseBlock>
      </TabsContent>

      <TabsContent value="dropdowns" className="pt-4">
        <ShowcaseBlock title="Dropdown Menu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Open Menu <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <User className="me-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="me-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <LogOut className="me-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ShowcaseBlock>
      </TabsContent>

      <TabsContent value="avatars" className="pt-4">
        <ShowcaseBlock title="Sizes & Fallbacks">
          <div className="flex items-center gap-4 flex-wrap">
            {(["h-6 w-6", "h-8 w-8", "h-10 w-10", "h-12 w-12", "h-16 w-16"] as const).map(size => (
              <TooltipProvider key={size}>
                <Tooltip>
                  <TooltipTrigger>
                    <Avatar className={size}>
                      <AvatarImage src="/invalid.jpg" alt="User" />
                      <AvatarFallback>AB</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>{size}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </ShowcaseBlock>
      </TabsContent>
    </Tabs>
  )
}
