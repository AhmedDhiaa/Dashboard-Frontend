"use client"

/**
 * Inline-editable LocalizedString cell.
 *
 * Render strategy:
 *   - `isEditing === false` (runtime route + canvas in preview mode):
 *     renders a plain element (the `as` prop, default `<span>`). Fully
 *     transparent — no extra DOM, no event handlers, no styling churn.
 *   - `isEditing === true` and unfocused: renders a click-to-edit button
 *     with hover ring.
 *   - `isEditing === true` and focused: swaps to `<input>` (or
 *     `<textarea>` when `multiline`) for clean caret behaviour.
 *
 * Commit lifecycle:
 *   - Local `draft` state captures keystrokes — keystrokes do NOT push
 *     into canvas state (and therefore do NOT pollute the undo stack).
 *   - Commit triggers: `blur`, plain `Enter` (single-line), or
 *     `Ctrl/Cmd+Enter` (multiline).
 *   - Cancel trigger: `Escape` reverts draft and blurs without commit.
 *   - `committedRef` guards against double-commit when `Enter` causes
 *     React to unmount the input and a blur event fires in the same
 *     task. The ref resets when the user re-enters edit mode.
 *
 * External value sync:
 *   - When `value` or `locale` changes while NOT focused (undo, props
 *     panel edit, locale toggle), `draft` is resynced so the next focus
 *     starts from the current value.
 *   - While focused, the user's typing wins — `value` changes are not
 *     blasted onto the in-progress edit.
 */

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type MutableRefObject } from "react"
import { cn } from "@/shared/utils"
import { usePageBuilderRender, type RenderLocale } from "../../renderer/PageBuilderRenderContext"

interface LocalizedValue {
  en: string
  ar: string
}

type TagName = "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div"

export interface InlineLocalizedTextProps {
  value: LocalizedValue

  /** Field key used in the commit callback (e.g. "text", "label"). */
  fieldKey: string

  /** Block id used in the commit callback. */
  blockId: string

  /** Render element when not editing (default: "span"). */
  as?: TagName

  /** Element class name (applied in both view + edit states). */
  className?: string

  /** Use textarea instead of input (for longer text blocks). */
  multiline?: boolean

  /** Placeholder shown when value is empty in current locale. */
  placeholder?: string

  /** Max length (defaults to FREE_TEXT_MAX from schema). */
  maxLength?: number
}

// Matches FREE_TEXT_MAX in schema/field-schema.ts (localizedStringSchema).
const FREE_TEXT_MAX = 500

export function InlineLocalizedText(props: InlineLocalizedTextProps) {
  const {
    value,
    fieldKey,
    blockId,
    as = "span",
    className,
    multiline = false,
    placeholder,
    maxLength = FREE_TEXT_MAX,
  } = props

  const { locale, isEditing, onEditField } = usePageBuilderRender()
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(value[locale] || "")
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  // Guards against the Enter-then-blur double commit: Enter handler
  // flips `focused` to false, which unmounts the input; in some browsers
  // a synthetic blur still flushes through. The ref lets handleCommit
  // short-circuit on its second invocation. Reset on every focus enter.
  const committedRef = useRef(false)

  useEffect(() => {
    if (!focused) {
      setDraft(value[locale] || "")
    }
  }, [value, locale, focused])

  if (!isEditing) {
    return <ViewMode as={as} className={className} value={value} locale={locale} placeholder={placeholder} />
  }

  const enterEditMode = () => {
    committedRef.current = false
    setFocused(true)
  }

  const handleCommit = () => {
    if (committedRef.current) return
    committedRef.current = true
    setFocused(false)
    if (draft !== (value[locale] || "")) {
      onEditField?.(blockId, fieldKey, { ...value, [locale]: draft })
    }
  }

  const handleCancel = () => {
    committedRef.current = true
    setDraft(value[locale] || "")
    setFocused(false)
  }

  if (focused) {
    return (
      <FocusedEditor
        multiline={multiline}
        draft={draft}
        setDraft={setDraft}
        onCommit={handleCommit}
        onCancel={handleCancel}
        maxLength={maxLength}
        className={className}
        blockId={blockId}
        fieldKey={fieldKey}
        locale={locale}
        inputRef={inputRef}
      />
    )
  }

  return (
    <ClickableDisplay
      as={as}
      className={className}
      value={value}
      locale={locale}
      placeholder={placeholder}
      blockId={blockId}
      fieldKey={fieldKey}
      onEnter={enterEditMode}
    />
  )
}

// ─── view mode (runtime route + preview not editing) ───────────────────────

interface ViewModeProps {
  as: TagName
  className?: string
  value: LocalizedValue
  locale: RenderLocale
  placeholder?: string
}

function ViewMode({ as: AsTag, className, value, locale, placeholder }: ViewModeProps) {
  const text = value[locale] || value.en || ""
  return <AsTag className={className}>{text || placeholder}</AsTag>
}

// ─── focused edit mode (input/textarea) ────────────────────────────────────

interface FocusedEditorProps {
  multiline: boolean
  draft: string
  setDraft: (next: string) => void
  onCommit: () => void
  onCancel: () => void
  maxLength: number
  className?: string
  blockId: string
  fieldKey: string
  locale: RenderLocale
  inputRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>
}

function FocusedEditor(props: FocusedEditorProps) {
  const { multiline, draft, setDraft, onCommit, onCancel, maxLength, className, blockId, fieldKey, locale, inputRef } =
    props

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
      return
    }
    if (e.key !== "Enter") return
    const submitNewline = multiline && !(e.metaKey || e.ctrlKey)
    if (submitNewline) return
    e.preventDefault()
    onCommit()
  }

  const sharedClass = cn(
    "w-full rounded-sm border border-primary bg-background px-1 outline-none ring-2 ring-primary/30",
    className,
  )
  const testId = `inline-edit-${blockId}-${fieldKey}`
  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value)

  if (multiline) {
    return (
      <textarea
        ref={el => {
          inputRef.current = el
        }}
        value={draft}
        onChange={onChange}
        onBlur={onCommit}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        autoFocus
        rows={3}
        className={sharedClass}
        data-testid={testId}
        data-inline-locale={locale}
      />
    )
  }
  return (
    <input
      ref={el => {
        inputRef.current = el
      }}
      type="text"
      value={draft}
      onChange={onChange}
      onBlur={onCommit}
      onKeyDown={handleKeyDown}
      maxLength={maxLength}
      autoFocus
      className={sharedClass}
      data-testid={testId}
      data-inline-locale={locale}
    />
  )
}

// ─── click-to-edit display (isEditing=true, not focused) ───────────────────

interface ClickableDisplayProps {
  as: TagName
  className?: string
  value: LocalizedValue
  locale: RenderLocale
  placeholder?: string
  blockId: string
  fieldKey: string
  onEnter: () => void
}

function ClickableDisplay(props: ClickableDisplayProps) {
  const { as: AsTag, className, value, locale, placeholder, blockId, fieldKey, onEnter } = props
  const displayText = value[locale] || value.en || ""
  const fallback = placeholder || `[${locale} empty]`
  return (
    <AsTag
      role="button"
      tabIndex={0}
      onClick={onEnter}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onEnter()
        }
      }}
      className={cn(
        "cursor-text rounded-sm px-0.5 transition-colors hover:bg-primary/5 hover:ring-1 hover:ring-primary/20",
        !displayText && "italic text-muted-foreground",
        className,
      )}
      data-testid={`inline-display-${blockId}-${fieldKey}`}
      data-inline-locale={locale}
    >
      {displayText || fallback}
    </AsTag>
  )
}
