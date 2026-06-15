/**
 * In-app translation editor — public surface.
 *
 * Mount the provider once at the dashboard layout; it owns the toggle,
 * the editor side-panel, the floating hover pencil, and the pending-edits
 * tray. The toggle button is exported separately so it can live inside
 * the existing header user-menu.
 */

export { TranslationEditorProvider, useTranslationEditor } from "./TranslationEditorContext"
export { EditModeToggle } from "./components/EditModeToggle"
export { EditOverlay } from "./components/EditOverlay"
export { EditPanel } from "./components/EditPanel"
export { PendingChangesTray } from "./components/PendingChangesTray"
export { TranslationsAdminPage } from "./admin/TranslationsAdminPage"
