/**
 * Application UI Components
 *
 * Application-specific UI compositions that are business-agnostic
 * but specific to this application's needs.
 */

export * from "./DashboardCard"
export * from "./Drawer"
export * from "./ErrorBoundary"
export * from "./file-preview"
export * from "./file-uploader"
export * from "./FilterDrawer"

// Image handling
export * from "./ImageUploader"
export * from "./image-crop-dialog"

// Hooks
export * from "./hooks/useConfirmDialog"
export * from "./hooks/useNotification"
export { useOverlayHost } from "./hooks/useOverlayHost"

// Contexts
export * from "./contexts/DrawerContext"
export { OverlayHostProvider, OverlayHostContext, resolveSheetSide } from "./contexts/OverlayHostContext"
export type {
  OverlayDialogOptions,
  OverlayDrawerOptions,
  OverlayHostContextValue,
  OverlaySide,
  OverlaySize,
} from "./contexts/OverlayHostContext"
