"use client"

import { useEffect, useState } from "react"
import { logger } from "@/shared/logger"
import { Users, Search, User as UserIcon } from "lucide-react"
import { userService, type IdentityUser } from "@/domains/user/user.service"
import { Input } from "@/ui/design-system/primitives/input"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Spinner } from "@/ui/design-system/primitives/Spinner"
import { useT } from "@/shared/config"
import Link from "next/link"

interface RoleMembersListProps {
  roleName: string
}

export function RoleMembersList({ roleName }: RoleMembersListProps) {
  const t = useT()
  const [users, setUsers] = useState<IdentityUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        // Note: ABP Identity users endpoint doesn't always support filtering by role name directly in getList
        // If it fails, we might need a dedicated endpoint or filter client-side if the list is small.
        // For standard ABP, we use the Filter param which might match role names if indexed.
        const result = await userService.getList({ filter: roleName, maxResultCount: 100 })
        setUsers(result.items)
      } catch (error) {
        logger.error("Failed to fetch role members", error)
      } finally {
        setLoading(false)
      }
    }

    if (roleName) {
      fetchUsers()
    }
  }, [roleName])

  const filteredUsers = users.filter(
    u =>
      u.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading)
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="relative group">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          placeholder={t("common.search")}
          className="ps-9 bg-muted/20 border-border/50 focus:border-primary/30 transition-all rounded-xl"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredUsers.length > 0 ? (
          filteredUsers.map(user => (
            <Link key={user.id} href={`/users/${user.id}`}>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary hover:shadow-md transition-all group">
                <div className="p-2 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{user.userName}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                {user.isActive ? (
                  <Badge variant="success" className="h-5 text-[10px]">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="h-5 text-[10px]">
                    Inactive
                  </Badge>
                )}
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50 bg-muted/10 rounded-2xl border border-dashed">
            <Users className="h-10 w-10 mb-2" />
            <p className="text-sm">{t("common.noData")}</p>
          </div>
        )}
      </div>
    </div>
  )
}
