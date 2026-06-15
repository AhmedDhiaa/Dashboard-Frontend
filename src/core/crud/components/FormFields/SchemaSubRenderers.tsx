import { EnumTypeName } from "@/core/enums"
import {
  TextField,
  TextAreaField,
  SwitchField,
  EntityAutocompleteField,
  SelectField,
  EnumSelectField,
  DateField,
  TagsField,
} from "@/core/crud/components/FormField"
import type { SubRendererProps } from "../SchemaFormRenderer.types"

export const RenderTextArea = ({ field, config, label, placeholder }: SubRendererProps) => (
  <TextAreaField
    key={field.name}
    name={field.name}
    label={label}
    required={field.required}
    placeholder={placeholder}
    description={config.description || field.description}
    rows={config.rows || 3}
    className={config.className}
  />
)

export const RenderNumberField = ({ field, config, label, placeholder }: SubRendererProps) => (
  <TextField
    key={field.name}
    name={field.name}
    label={label}
    required={field.required}
    placeholder={placeholder}
    description={config.description || field.description}
    type="number"
    min={config.min}
    max={config.max}
    step={config.step}
    className={config.className}
  />
)

export const RenderBooleanField = ({ field, config, label }: SubRendererProps) => (
  <SwitchField
    key={field.name}
    name={field.name}
    label={label}
    description={config.description || field.description}
    className={config.className}
  />
)

export const RenderAutocompleteField = ({ field, config, label, placeholder, t }: SubRendererProps) => (
  <EntityAutocompleteField
    key={field.name}
    name={field.name}
    label={label}
    required={field.required}
    entityName={config.entityName || field.name.replace(/Id$/, "")}
    placeholder={placeholder}
    searchPlaceholder={
      config.searchPlaceholder || (t ? t(`common.placeholders.search_${field.name.replace(/Id$/, "")}`) : "")
    }
    renderSelected={config.renderSelected}
    renderItem={config.renderItem}
    multiple={config.multiple}
    valueKey={config.valueKey}
    customEndpoint={config.customEndpoint}
    className={config.className}
  />
)

export const RenderSelectField = ({ field, config, label, placeholder }: SubRendererProps) => (
  <SelectField
    key={field.name}
    name={field.name}
    label={label}
    required={field.required}
    placeholder={placeholder}
    description={config.description || field.description}
    options={(config.options as Array<{ value: string | number; label: string }>) || []}
    disabled={config.disabled}
    direction={config.direction}
  />
)

export const RenderEnumField = ({ field, config, label, placeholder }: SubRendererProps) => (
  <EnumSelectField
    key={field.name}
    name={field.name}
    label={label}
    required={field.required}
    placeholder={placeholder}
    description={config.description || field.description}
    enumType={config.enumType as EnumTypeName}
    disabled={config.disabled}
    direction={config.direction}
  />
)

export const RenderDefaultField = ({ field, config, label, placeholder }: SubRendererProps) => (
  <TextField
    key={field.name}
    name={field.name}
    label={label}
    required={field.required}
    placeholder={placeholder}
    description={config.description || field.description}
    type={(config.type as "text" | "number" | "password" | "email" | "tel" | "url") || "text"}
    min={config.min}
    max={config.max}
    step={config.step}
    className={config.className}
  />
)

export const RenderDateField = ({ field, config, label, placeholder }: SubRendererProps) => (
  <DateField
    key={field.name}
    name={field.name}
    label={label}
    required={field.required}
    placeholder={placeholder}
    description={config.description || field.description}
    className={config.className}
  />
)

export const RenderTagsField = ({ field, config, label, placeholder }: SubRendererProps) => (
  <TagsField
    key={field.name}
    name={field.name}
    label={label}
    required={field.required}
    placeholder={placeholder}
    description={config.description || field.description}
    disabled={config.disabled}
    className={config.className}
    maxCount={config.maxCount}
    allowDuplicates={config.allowDuplicates}
  />
)
