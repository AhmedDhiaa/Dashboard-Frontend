/**
 * Mock handler for ABP Identity (users + roles).
 *
 * The user/role CRUD pages talk to `/api/identity/users` and
 * `/api/identity/roles` (NOT the generic `/api/app/<entity>` path), so the
 * generic CRUD handler can't serve them. This handler returns deterministic,
 * ABP-shaped users and roles so the Users / Roles screens are fully populated
 * in standalone mock mode — the same way they were before the backend split.
 *
 * Routes handled (everything under `identity/`):
 *   GET  identity/users                      → { items, totalCount }
 *   GET  identity/users/<id>                 → IdentityUser
 *   GET  identity/users/<id>/roles           → { items: roles }
 *   GET  identity/users/assignable-roles     → { items: roles }
 *   GET  identity/roles                       → { items, totalCount }
 *   GET  identity/roles/all                   → { items: roles }
 *   GET  identity/roles/<id>                  → IdentityRole
 *   POST|PUT|DELETE …                         → echo / 204 (session-persistent feel)
 */

const NOW = "2024-06-01T09:00:00Z"

interface MockRole {
  id: string
  name: string
  isDefault: boolean
  isPublic: boolean
  isStatic: boolean
  concurrencyStamp: string
  creationTime: string
}

interface MockUser {
  id: string
  userName: string
  name: string
  surname: string
  email: string
  phoneNumber: string
  isActive: boolean
  emailConfirmed: boolean
  roleNames: string[]
  roles: string[]
  permissions: number
  concurrencyStamp: string
  creationTime: string
}

const ROLES: readonly MockRole[] = [
  { id: "role-1-admin", name: "admin", isDefault: false, isPublic: true, isStatic: true },
  { id: "role-2-manager", name: "manager", isDefault: false, isPublic: true, isStatic: false },
  { id: "role-3-operator", name: "operator", isDefault: true, isPublic: true, isStatic: false },
  { id: "role-4-support", name: "support", isDefault: false, isPublic: true, isStatic: false },
  { id: "role-5-viewer", name: "viewer", isDefault: false, isPublic: false, isStatic: false },
].map((r, i) => ({ ...r, concurrencyStamp: `cs-role-${i}`, creationTime: NOW }))

const USER_SEEDS: ReadonlyArray<[string, string, string, string[]]> = [
  ["admin", "Demo", "Admin", ["admin"]],
  ["s.ali", "Sara", "Ali", ["manager"]],
  ["o.hassan", "Omar", "Hassan", ["operator"]],
  ["z.hadi", "Zainab", "Hadi", ["operator", "support"]],
  ["m.kadhim", "Mohammed", "Kadhim", ["support"]],
  ["n.salem", "Noor", "Salem", ["viewer"]],
  ["y.jasim", "Yousif", "Jasim", ["operator"]],
  ["f.amer", "Fatima", "Amer", ["manager", "viewer"]],
]

const USERS: readonly MockUser[] = USER_SEEDS.map(([userName, name, surname, roleNames], i) => ({
  id: `user-${i + 1}-0000-0000-000000000000`,
  userName,
  name,
  surname,
  email: `${userName.replace(/\./g, "")}@example.com`,
  phoneNumber: `0770${String(1000000 + i * 13579).slice(0, 7)}`,
  isActive: i % 5 !== 4,
  emailConfirmed: i % 3 !== 2,
  roleNames,
  roles: roleNames,
  permissions: 8 + ((i * 7) % 40),
  concurrencyStamp: `cs-user-${i}`,
  creationTime: NOW,
}))

const paged = <T>(items: readonly T[], params: Record<string, unknown>) => {
  const skip = Number(params.SkipCount ?? params.skipCount ?? 0)
  const take = Number(params.MaxResultCount ?? params.maxResultCount ?? 20)
  return { items: items.slice(skip, skip + (take > 0 ? take : 20)), totalCount: items.length }
}

/** `identity/roles…` — list / all / getById / create / update / delete. */
function rolesResponse(
  method: string,
  id: string | undefined,
  params: Record<string, unknown>,
  body: Record<string, unknown>,
): unknown {
  if (id === "all") return { items: ROLES }
  if (!id) {
    if (method === "post") return { ...ROLES[2], ...body, id: `role-new-${ROLES.length}` }
    return paged(ROLES, params)
  }
  const role = ROLES.find(r => r.id === id) ?? ROLES[0]
  if (method === "put") return { ...role, ...body }
  if (method === "delete") return null
  return role
}

/** `identity/users…` — list / getById / create / update / delete + roles sub-routes. */
function usersResponse(
  method: string,
  id: string | undefined,
  sub: string | undefined,
  params: Record<string, unknown>,
  body: Record<string, unknown>,
): unknown {
  if (id === "assignable-roles") return { items: ROLES }
  if (!id) {
    if (method === "post") return { ...USERS[1], ...body, id: `user-new-${USERS.length}` }
    return paged(USERS, params)
  }
  // users/<id>/roles — GET returns the user's roles, PUT just acknowledges.
  if (sub === "roles") {
    if (method === "put") return null
    const u = USERS.find(x => x.id === id)
    return { items: ROLES.filter(r => (u?.roleNames ?? ["operator"]).includes(r.name)) }
  }
  const user = USERS.find(u => u.id === id) ?? USERS[0]
  if (method === "put") return { ...user, ...body }
  if (method === "delete") return null
  return user
}

/** Resolve an `identity/...` mock response, or `null` if not an identity path. */
export function identityResponse(
  path: string,
  method: string,
  params: Record<string, unknown>,
  body: Record<string, unknown>,
): unknown | null {
  const segs = path.split("/").filter(Boolean) // e.g. ["identity","users","<id>","roles"]
  if (segs[0] !== "identity") return null
  const [, resource, second, third] = segs
  if (resource === "roles") return rolesResponse(method, second, params, body)
  if (resource === "users") return usersResponse(method, second, third, params, body)
  return { items: [], totalCount: 0 } // unknown identity sub-path → safe empty list
}
