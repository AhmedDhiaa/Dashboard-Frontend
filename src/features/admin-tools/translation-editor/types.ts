/**
 * Domain types for the in-app translation editor.
 *
 * `flatKey` everywhere is `<namespace>.<keyPath>` — same shape the storage
 * layer (src/app/api/i18n/_lib/storage.ts) uses on disk and on the wire.
 */

export interface KeyDescriptor {
  namespace: string
  keyPath: string
  flatKey: string
}

export interface TranslationCallRecord extends KeyDescriptor {
  /** The string the call resolved to (with overrides + params already applied). */
  rendered: string
}

export interface PendingEdit extends KeyDescriptor {
  /** The new value the admin typed but hasn't saved yet. */
  draft: string
  /** The value the editor opened with (file value + any current override). */
  baseline: string
}

export interface TranslationEditorContextValue {
  enabled: boolean
  toggle: () => void
  /** Open the side panel for the given key (used by the hover-pencil click). */
  edit: (descriptor: KeyDescriptor) => void
  /** The descriptor currently shown in the side panel, or null if closed. */
  activeKey: KeyDescriptor | null
  closePanel: () => void
  /** Map of every (namespace, key) call observed since edit mode was enabled. */
  callIndex: ReadonlyMap<string, TranslationCallRecord>
  /** Reverse index: rendered text → set of flatKeys. Powers the hover lookup. */
  textIndex: ReadonlyMap<string, ReadonlySet<string>>
  /** Pending (unsaved) edits keyed by flatKey. */
  pending: ReadonlyMap<string, PendingEdit>
  setPending: (descriptor: KeyDescriptor, draft: string, baseline: string) => void
  discardPending: (flatKey: string) => void
  /** Save a single edit immediately. Returns the new server version. */
  saveEdit: (descriptor: KeyDescriptor, value: string) => Promise<number>
  /** Delete an existing override (revert to file value). */
  revertOverride: (descriptor: KeyDescriptor) => Promise<number>
  /** Loop saveEdit over every pending edit. */
  publishAll: () => Promise<void>
  /** Currently-loaded server overrides for the active locale. */
  overrides: Record<string, string>
  /** Current locale (en/ar). */
  locale: "en" | "ar"
}
