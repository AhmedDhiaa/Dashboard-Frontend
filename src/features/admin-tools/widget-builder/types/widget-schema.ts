/**
 * Compatibility re-export. The widget schema lives at
 * `@/shared/widgets/schema` so both the wizard (admin-tools) and the
 * canvas (dashboard) can import it without breaking domain isolation.
 */

export {
  widgetBuilderSchema,
  WIDGET_CATEGORIES,
  type WidgetBuilderSchema,
  type WidgetCategory,
  type DataSource,
  type Visualization,
  type RefreshPolicy,
  type LocalisedString,
} from "@/shared/widgets/schema"
