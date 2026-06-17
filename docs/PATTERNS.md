# Frontend patterns & conventions

Hard-won conventions that aren't obvious from the code alone. Each entry
states the rule, the reasoning, and the regression test that pins it — so
the class of bug it prevents can't quietly come back.

---

## Form fields: controlled vs. uncontrolled

**Rule.** The `Input` and `Textarea` primitives
([`src/ui/design-system/primitives/input.tsx`](../src/ui/design-system/primitives/input.tsx),
[`textarea.tsx`](../src/ui/design-system/primitives/textarea.tsx)) only inject
a `value` onto the native element when the caller actually passes a `value`
prop (`"value" in props`). A caller that passes **no** `value` stays
uncontrolled.

**Why.** React treats a native `<input>`/`<textarea>` as *controlled* the
moment it sees a `value` prop. A controlled field with no `onChange` is
read-only, and React warns:

> You provided a `value` prop to a form field without an `onChange` handler.
> This will render a read-only field.

The primitives used to coerce `value` (null/undefined → `""`) and pass it
**unconditionally**. That silently converted every uncontrolled usage —
`<Input defaultValue="…" />`, a ref-driven field, or a `{...spread}` that
omits `value` — into a broken, read-only controlled field that also spammed
the console. The fix scopes the coercion to genuinely controlled callers and
keeps the null→`""` safety for them (so a controlled field never flips to
uncontrolled mid-edit).

**How to apply.**

- **Controlled** (most form fields, react-hook-form `Controller`): pass
  **both** `value` and `onChange`. RHF's `field` object always carries a
  `value` key, so spreading `{...field}` is controlled by construction.
- **Uncontrolled** (defaults, refs, search boxes you read on submit): pass
  `defaultValue` (or nothing) and **omit** `value`. Do not pass `value`
  "just to set the initial text" — that's what `defaultValue` is for.
- **Read-only display** of a value: pass `value` **and** `readOnly`, never
  `value` alone.

**Pinned by.**
[`input-textarea.controlled.test.tsx`](../src/ui/design-system/primitives/__tests__/input-textarea.controlled.test.tsx)
— asserts an uncontrolled field renders its `defaultValue`, stays editable,
emits no warning; and that a controlled `value={null}` normalizes to `""`
and still fires `onChange`.

---

## Where to go next

- **Development walkthroughs** → [`docs/DEVELOPMENT.md`](DEVELOPMENT.md).
- **Admin / day-2 work** → [`docs/ADMIN-TOOLS.md`](ADMIN-TOOLS.md).
- **Production runbooks** → [`docs/runbooks/`](runbooks/).
