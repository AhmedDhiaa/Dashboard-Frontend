/**
 * Backend port — the single seam between the app and whatever backend serves it.
 *
 * This file defines transport-NEUTRAL interfaces and DTOs only (no axios, no
 * `/api/app`, no `{ error_description }`, no `grantedPolicies`). The concrete
 * **ABP adapter** (default) and the **mock adapter** implement these in
 * `src/infra/api/adapters/**`; a composition root selects one. Feature, domain,
 * core, and ui code depend on THIS file, never on the adapter internals.
 *
 * It lives under `src/shared/` because that is the only layer every consumer is
 * allowed to import (`ui` may not import `infra`). See
 * `docs/BACKEND-ADAPTER-PLAN.md` for the full map + phased migration.
 *
 * STATUS: Phase 0 scaffold. No consumers are wired yet — adding this file is
 * non-breaking. Each later phase moves one subsystem behind these interfaces.
 *
 * Error contract: adapters reject/throw the existing `AppError` hierarchy from
 * `@/shared/types` (already transport-free), so consumers' error handling is
 * unchanged. The port intentionally does not re-declare those classes.
 */

// ─── List / pagination (transport-neutral) ──────────────────────────────────

/** One sort directive. The adapter encodes it for its backend (ABP → "field dir"). */
export interface SortSpec {
  field: string
  direction: "asc" | "desc"
}

/**
 * Neutral list request. The ABP adapter maps these to `skipCount` /
 * `maxResultCount` / `Sorting` / `Term`|`Filter` / repeated filter params.
 */
export interface ListParams {
  /** Zero-based page index (adapter converts to skip/offset). */
  page?: number
  /** Items per page. */
  pageSize?: number
  /** Free-text search term. */
  search?: string
  /** Ordering, applied in order. */
  sort?: SortSpec[]
  /** Backend-neutral structured filters (field → value | values). */
  filters?: Record<string, unknown>
}

/**
 * Neutral page result. Field names match the current consumers (`items` /
 * `totalCount`) so the Phase-1 migration is low-churn; the point is that the
 * ADAPTER produces this shape from whatever its backend returns.
 */
export interface Page<T> {
  items: T[]
  totalCount: number
}

// ─── CRUD / entity service ──────────────────────────────────────────────────

/**
 * Per-resource CRUD contract. The ABP adapter resolves `resource` to an ABP URL
 * (`/api/app/<resource>` or a framework path) and maps the envelope; a different
 * backend resolves it however it likes.
 */
export interface EntityService<TEntity, TCreate = Partial<TEntity>, TUpdate = Partial<TEntity>> {
  list(params?: ListParams): Promise<Page<TEntity>>
  getById(id: string | number): Promise<TEntity>
  create(data: TCreate): Promise<TEntity>
  update(id: string | number, data: TUpdate): Promise<TEntity>
  delete(id: string | number): Promise<void>
  autocomplete(params: { term?: string; id?: string | number; maxResultCount?: number }): Promise<TEntity[]>
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface Credentials {
  username: string
  password: string
}

/** What a backend hands back for a login/refresh. Adapter hides the grant flow. */
export interface TokenSet {
  accessToken: string
  refreshToken?: string
  /** Seconds until `accessToken` expires. */
  expiresIn: number
}

/** Backend-neutral identity, derived by the adapter from its profile/config call. */
export interface BackendUser {
  id: string
  name?: string
  email?: string
  roles: string[]
  tenantId?: string | null
  /** Granted permission keys (the adapter flattens its own permission model). */
  permissions: string[]
}

export interface AuthPort {
  login(credentials: Credentials): Promise<TokenSet>
  refresh(refreshToken: string): Promise<TokenSet>
  getProfile(accessToken: string): Promise<BackendUser>
  requestPasswordReset(email: string): Promise<void>
  resetPassword(input: { userId: string; resetToken: string; password: string }): Promise<void>
}

// ─── Application config (permissions / settings / features) ──────────────────

export interface ApplicationConfig {
  /** Granted permission keys (adapter flattens e.g. ABP `grantedPolicies`). */
  permissions: string[]
  settings: Record<string, string>
  features: Record<string, string>
  roles: string[]
  user: BackendUser | null
}

export interface ConfigPort {
  getApplicationConfig(): Promise<ApplicationConfig>
}

// ─── Enums ──────────────────────────────────────────────────────────────────

/** Neutral enum value (the adapter maps its backend's enum payload to this). */
export interface EnumValueDTO {
  id: number
  /** Primary display name. */
  name: string
  /** Secondary/localized name (e.g. the AR label in the current bilingual setup). */
  foreignName?: string
  code?: string
  localization?: { name?: string }
}

export interface EnumPort {
  getEnumValues(type: string): Promise<EnumValueDTO[]>
}

// ─── The umbrella port + composition ────────────────────────────────────────

/** A concrete backend implements all of these. The composition root picks one. */
export interface BackendPort {
  auth: AuthPort
  config: ConfigPort
  enums: EnumPort
  /** Factory for per-resource CRUD services. */
  entity<TEntity, TCreate = Partial<TEntity>, TUpdate = Partial<TEntity>>(
    resource: string,
  ): EntityService<TEntity, TCreate, TUpdate>
}

/** Selector value for the composition root. */
export type BackendKind = "abp" | "mock"
