/**
 * Single source of truth for fully-qualified permission keys.
 *
 * The backend grants flat ABP-style strings of shape `Api.<Module>.<Action>`
 * (or `Api.<Module>.<SubModule>` for namespace-style permissions). When
 * those strings live as raw literals in guards, route handlers, and the
 * navigation file, a typo silently denies access — the user just sees an
 * empty page or a 403 with no compile-time signal.
 *
 * Keep every fully-qualified literal in this map. Tests (`*.test.{ts,tsx}`,
 * `__tests__/`, `test-utils/`) and the API-settings group registry (which
 * names *setting* prefixes that happen to share the `Api.*.X` shape) are
 * the only allowlisted exceptions to the `custom/no-string-permission-key`
 * rule — see `eslint.config.mjs`.
 *
 * Two-segment prefixes (`Api.Brand`, `Api.City`) live on each entity's
 * config file (`permissionKey`); the system synthesizes
 * `<prefix>.Create | .Update | .Delete | .View` at check time.
 * Those are intentionally NOT in this map — they're owned by the entity
 * config that anchors them.
 */

export const PERMISSIONS = {
  // ─── Admin tools (developer / power-user surfaces) ───────────────────────
  ADMIN_ENTITY_BUILDER: "Api.Admin.EntityBuilder",
  ADMIN_WIDGET_BUILDER: "Api.Admin.WidgetBuilder",
  ADMIN_PAGE_BUILDER: "Api.Admin.PageBuilder",
  /**
   * Dev-only git-bridge surface (/admin/git). Intentionally separate from
   * the *Builder permissions because the blast radius is different:
   * git operations commit + push source files. Gating on this key means
   * a power user with EntityBuilder can still be denied git access.
   */
  ADMIN_GIT_OPERATIONS: "Api.Admin.GitOperations",
  THEME_MANAGE: "Api.Theme.Manage",
  TRANSLATION_MANAGE: "Api.Translation.Manage",
  RUNTIME_MANAGE: "Api.Runtime.Manage",
  RUNTIME_WRITE: "Api.Runtime.Write",

  // ─── Dashboard surface ───────────────────────────────────────────────────
  DASHBOARD_COUNT: "Api.Dashboard.Count",

  // ─── Order actions ───────────────────────────────────────────────────────
  ORDER_CREATE: "Api.Order.Create",

  // ─── Reports ─────────────────────────────────────────────────────────────
  REPORT_STOCK_TRANSACTION: "Api.Report.StockTransactionReport",
  REPORT_STOCK_TRANSACTION_QUANTITY: "Api.Report.StockTransactionQuantityReport",
  REPORT_ITEM_TRANSACTION: "Api.Report.ItemTransactionReport",
  REPORT_ORDER_ON_MAP: "Api.Report.OrderOnMapReport",
  REPORT_PAYMENT_AND_RECEIVE: "Api.Report.PaymentAndReceiveReport",
  REPORT_EMPLOYEE_RECEIVE: "Api.Report.EmployeeReceiveReport",
  REPORT_WORK_SESSION: "Api.Report.WorkSessionReport",
  REPORT_SALES_INVOICE_ITEM: "Api.Report.SalesInvoiceItemReport",
  REPORT_SALES_INVOICE_ITEM_DOCUMENT: "Api.Report.SalesInvoiceItemDocumentReport",
  REPORT_SALES_INVOICE_ITEM_EMPLOYEE: "Api.Report.SalesInvoiceItemEmployeeReport",
} as const

/**
 * Union of every permission-key literal in the central map. Consumers
 * that need to type a parameter as "a fully-qualified permission key"
 * should use this — it stays in sync with `PERMISSIONS` automatically
 * because it's derived from it.
 */
