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

/**
 * List/search parameters. Relocated here from `infra/api` so consumers depend on
 * the port, not the transport. NOTE: it still carries the current
 * (ABP-influenced) field vocabulary (`pageNumber`/`skipCount`/`searchKey`/
 * `sorting`/`term`); a later refinement may neutralize the shape and let the
 * adapter own the encoding. Behavior is unchanged for now.
 */
export interface CRUDListParams {
  pageNumber?: number
  pageSize?: number
  searchKey?: string
  sortBy?: string
  sortDirection?: "asc" | "desc"
  skipCount?: number
  maxResultCount?: number
  sorting?: string
  term?: string
  /** Override the search param name (default "Term"; Role uses "Filter"). */
  searchParam?: string
  /** Allow any custom filters to be passed through, including multi-select arrays. */
  [key: string]: string | number | boolean | (string | number)[] | undefined
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
export interface EntityService<
  TEntity extends { id: string | number },
  TCreate = Partial<TEntity>,
  TUpdate = Partial<TEntity>,
> {
  getList(params?: CRUDListParams): Promise<Page<TEntity>>
  getById(id: string | number): Promise<TEntity>
  create(data: TCreate): Promise<TEntity>
  update(id: string | number, data: TUpdate): Promise<TEntity>
  delete(id: string | number): Promise<void>
  autocomplete(params?: { term?: string; id?: number; maxResultCount?: number }): Promise<TEntity[]>
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
  /** Seconds until `accessToken` expires (absent → the caller's default lifetime). */
  expiresIn?: number
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

/** Trigger a self-service password-reset email. */
export interface PasswordResetRequest {
  email: string
  /** App name the backend uses to pick the email template + return URL. */
  appName?: string
  /** Where the backend's reset link should point (the app's reset page). */
  returnUrl?: string
}

/** Complete a password reset with the token from the reset email. */
export interface PasswordReset {
  userId: string
  resetToken: string
  password: string
}

/**
 * Authentication: token grants + self-service account recovery. Profile/
 * permission loading lives in `ConfigPort` (see `getApplicationConfig`); the
 * adapter hides each backend's grant + account-endpoint shapes.
 */
export interface AuthPort {
  login(credentials: Credentials): Promise<TokenSet>
  refresh(refreshToken: string): Promise<TokenSet>
  /** Self-service recovery: trigger a password-reset email. */
  sendPasswordResetCode(request: PasswordResetRequest): Promise<void>
  /** Self-service recovery: complete the reset with the emailed token. */
  resetPassword(reset: PasswordReset): Promise<void>
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

/**
 * Enum value as the app consumes it (structurally matches `core/enums`'
 * `EnumValue`). The adapter maps its backend's enum payload to this shape.
 */
export interface EnumValueDTO {
  id: number
  /** Primary display name. */
  name: string
  /** Secondary/localized name (the AR label in the current bilingual setup). */
  foreignName: string
  code?: string
  localization?: { name: string; value: string }
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
  entity<TEntity extends { id: string | number }, TCreate = Partial<TEntity>, TUpdate = Partial<TEntity>>(
    resource: string,
  ): EntityService<TEntity, TCreate, TUpdate>
}

/** Selector value for the composition root. */
export type BackendKind = "abp" | "mock"
