"use client"

import { useState, useEffect, useCallback } from "react"
import { Shield, Search, RefreshCw } from "lucide-react"
import { useT } from "@/shared/config"
import { userService } from "@/domains/user/user.service"
import type { IdentityUserRole } from "@/shared/types/security.types"
import { useNotification } from "@/ui/application/hooks/useNotification"
import { Button } from "@/ui/design-system/primitives/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/design-system/primitives/dialog"
import { Input } from "@/ui/design-system/primitives/input"
import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { UserRoleItem } from "./UserRoleItem"

interface UserRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | null
  userName?: string
  onSuccess?: () => void
}

export function UserRoleModal({ open, onOpenChange, userId, userName, onSuccess }: UserRoleModalProps) {
  const t = useT()
  const notify = useNotification()
  const [roles, setRoles] = useState<IdentityUserRole[]>([])
  const [userRoles, setUserRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const loadData = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const [allRoles, assigned] = await Promise.all([
        userService.getAssignableRoles(),
        userService.getUserRoles(userId),
      ])
      setRoles(allRoles.items)
      setUserRoles(assigned.items.map(r => r.name))
    } catch {
      notify.error("common.messages.errorLoad")
    } finally {
      setLoading(false)
    }
  }, [userId, notify])

  useEffect(() => {
    if (open && userId) {
      loadData()
    } else if (!open) {
      setSearchTerm("")
    }
  }, [open, userId, loadData])

  const handleToggleRole = (roleName: string) => {
    setUserRoles(prev => (prev.includes(roleName) ? prev.filter(r => r !== roleName) : [...prev, roleName]))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await userService.updateUserRoles(userId!, userRoles)
      notify.success("common.messages.successUpdate")
      onSuccess?.()
      onOpenChange(false)
    } catch {
      notify.error("common.messages.errorUpdate")
    } finally {
      setSaving(false)
    }
  }

  const filteredRoles = roles.filter(role => role.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-card border border-border shadow-sm">
        <UserRoleHeader t={t} searchTerm={searchTerm} setSearchTerm={setSearchTerm} userName={userName} />

        <div className="max-h-[350px] overflow-y-auto p-4 scrollbar-thin">
          <UserRolesContent
            loading={loading}
            filteredRoles={filteredRoles}
            userRoles={userRoles}
            handleToggleRole={handleToggleRole}
            t={t}
          />
        </div>

        <UserRoleFooter saving={saving} onCancel={() => onOpenChange(false)} onSave={handleSave} t={t} />
      </DialogContent>
    </Dialog>
  )
}

interface UserRoleHeaderProps {
  t: (key: string) => string
  searchTerm: string
  setSearchTerm: (v: string) => void
  userName?: string
}

function UserRoleHeader({ t, searchTerm, setSearchTerm, userName }: UserRoleHeaderProps) {
  return (
    <div className="p-6 pb-4 bg-muted/40 border-b border-border">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <Shield className="h-5 w-5 text-primary" />
          {userName || t("pages.businessPartner.user_account")}
        </DialogTitle>
        <DialogDescription>{t("pages.businessPartner.user_account_description")}</DialogDescription>
      </DialogHeader>
      <div className="relative mt-4 group">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors duration-200" />
        <Input
          placeholder={t("common.placeholders.search")}
          className="ps-9 bg-background border-border rounded-lg h-10"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
    </div>
  )
}

interface UserRolesContentProps {
  loading: boolean
  filteredRoles: IdentityUserRole[]
  userRoles: string[]
  handleToggleRole: (name: string) => void
  t: (key: string) => string
}

function UserRolesContent({ loading, filteredRoles, userRoles, handleToggleRole, t }: UserRolesContentProps) {
  if (loading)
    return (
      <div className="space-y-3 p-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  if (filteredRoles.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50">
        <Shield className="h-10 w-10 mb-2" />
        <p className="text-sm">{t("common.noData")}</p>
      </div>
    )
  return (
    <div className="grid gap-2">
      {filteredRoles.map(role => (
        <UserRoleItem
          key={role.id}
          role={role}
          isSelected={userRoles.includes(role.name)}
          onToggle={handleToggleRole}
        />
      ))}
    </div>
  )
}

interface UserRoleFooterProps {
  saving: boolean
  onCancel: () => void
  onSave: () => void
  t: (key: string) => string
}

function UserRoleFooter({ saving, onCancel, onSave, t }: UserRoleFooterProps) {
  return (
    <div className="p-4 bg-muted/40 border-t border-border flex justify-end gap-3 mt-auto">
      <Button variant="outline" onClick={onCancel} className="rounded-lg px-6">
        {t("common.cancel")}
      </Button>
      <Button onClick={onSave} disabled={saving} className="rounded-lg px-8">
        {saving && <RefreshCw className="me-2 h-4 w-4 animate-spin" />}
        {t("common.save")}
      </Button>
    </div>
  )
}
