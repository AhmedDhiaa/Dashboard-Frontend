# Page Builder — User Guide / دليل المستخدم

> **Audience:** admins building dashboard pages without writing code.
> **الجمهور:** مسؤولو لوحة التحكم الذين يبنون صفحات بدون كتابة كود.

This guide is split into bilingual sections — every step is documented in
English first, then in Arabic. Use whichever side you prefer.

---

## 1. What the Page Builder is / ما هو Page Builder

**English.** A WYSIWYG editor that turns a JSON schema into a real
dashboard page. Behind the scenes the same React components your engineers
use (`Card`, `Tabs`, `CRUDListPage`, `SchemaFormRenderer`, `UnifiedMap`,
…) get composed at runtime — no new code is written for each page.

**عربي.** محرّر صفحات يحوّل وصفاً JSON إلى صفحة عمل حقيقية على لوحة
التحكم. خلف الكواليس تُركَّب نفس مكوّنات React التي يستخدمها المهندسون
(`Card`, `Tabs`, `CRUDListPage`, `SchemaFormRenderer`, `UnifiedMap`، …) —
دون كتابة كود لكل صفحة.

---

## 2. Opening the canvas / فتح اللوحة

**English.** Navigate to **`/admin/page-builder`**. You need the
`Api.Admin.PageBuilder` permission; if you don't see the link in the
sidebar, ask an admin to grant it.

**عربي.** افتح **`/admin/page-builder`**. تحتاج صلاحية
`Api.Admin.PageBuilder`؛ إذا لا تظهر لك في القائمة الجانبية اطلب من
المسؤول منحها.

---

## 3. Building from scratch / البناء من الصفر

### Step-by-step / خطوات

1. The canvas opens with an empty page. The left rail shows every block
   type grouped by category (Content, Layout, Data, Form, Action).
2. Drag a block from the palette into the center column, or click the
   block in the palette to append it.
3. Click any block in the center list to select it. The right panel shows
   the block's JSON properties — edit them and press **Apply**.
4. Click **Save**. The page is persisted under
   `messages/_overrides/pages/<pageId>.json` and visible immediately at
   `/pages/<pageId>` in another tab.

اللوحة تفتح فارغة. الشريط الأيسر يعرض كل أنواع البلوكات مجمَّعة حسب
الفئة (محتوى، تخطيط، بيانات، نموذج، إجراء). اسحب البلوك إلى العمود
الأوسط أو اضغطه. اختر البلوك من القائمة لتعديل خصائصه في اللوحة اليمنى
بصيغة JSON ثم اضغط **Apply**. اضغط **Save** فتُحفظ الصفحة وتظهر فوراً
على `/pages/<pageId>`.

### Reordering blocks / إعادة ترتيب البلوكات

**English.** The **Layers** tab supports drag-and-drop to reorder
blocks or move them between containers:

1. Hover any block — a drag handle (⠿ icon) appears at the start of
   the row.
2. Press and hold the handle, then move at least 5 pixels to start
   dragging.
3. A floating preview follows the cursor while dragging.
4. Blue indicators show where the block will land:
   - A line above another block — drop here to reorder.
   - A highlighted container — drop inside to nest.
   - A pulsing dotted border — drop into an empty slot.
5. Release to drop. Invalid drops (e.g. dropping a card into one of
   its own children) are rejected with a warning toast and the
   schema is unchanged.

Two keyboard-friendly alternatives stay available next to every block:
the **↑↓ buttons** for single-step reorder within the same slot, and
the **Move to ▶** submenu in the **⋮** actions menu for any legal
destination across the tree.

**عربي.** تبويب **Layers** يدعم السحب والإفلات لإعادة ترتيب البلوكات
أو نقلها بين الحاويات:

1. مرِّر الفأرة فوق أي بلوك — يظهر مقبض السحب (أيقونة ⠿) في بداية
   الصف.
2. اضغط على المقبض واسحب 5 بكسلات على الأقل لبدء السحب.
3. معاينة عائمة تتبع المؤشر أثناء السحب.
4. مؤشرات زرقاء تظهر موقع الإفلات:
   - خط فوق بلوك آخر — إفلات هنا لإعادة الترتيب.
   - حاوية مضيئة — إفلات داخلها للتداخل.
   - حدود متقطعة نابضة — إفلات في خانة فارغة.
5. حرِّر الفأرة للإفلات. الإفلاتات غير الصالحة (مثل وضع بطاقة داخل
   أحد أبنائها) تُرفض مع تنبيه warning ويبقى الـ schema كما هو.

بديلان متاحان بالـ keyboard لكل بلوك: أزرار **↑↓** لإعادة ترتيب بخطوة
واحدة داخل نفس الـ slot، والقائمة الفرعية **Move to ▶** في قائمة
الإجراءات (**⋮**) لأي وجهة صالحة في الشجرة.

---

## 4. Building from a Swagger spec / البناء من Swagger

This is the fastest path: point the wizard at your backend's OpenAPI
URL and pick a resource cluster.

1. In the canvas header click **Create from API**.
2. Paste the URL — usually `https://api.example.com/swagger/v1/swagger.json`.
   The default already points to your project's `NEXT_PUBLIC_API_URL`.
3. Click **Fetch**. The wizard discovers every resource cluster — each
   group of `GET /list`, `POST /create`, `GET /{id}`, `PUT /{id}`,
   `DELETE /{id}` plus any custom actions like `POST /{id}/close`.
4. Click a cluster (e.g. `orders`). The wizard generates a draft page
   with:
   - A `table` block backed by the list endpoint.
   - Auto-suggested columns from the response item schema.
   - Row actions for view, edit, delete + every custom action.
5. Tweak the title, icon, navigation group in the right-side
   PropertiesPanel.
6. **Save**.

في الـ header اضغط **Create from API**. الصق رابط Swagger (الافتراضي
يشير إلى `NEXT_PUBLIC_API_URL`). اضغط **Fetch**. تظهر الموارد المكتشفة
كقائمة شجرية. اختر مورداً (مثل `orders`) — تولَّد صفحة مسودة فيها جدول
يقرأ من endpoint قائمة المورد، أعمدة مقترَحة من شكل الـ item،
وإجراءات صفّ تلقائية لـ view/edit/delete + كل custom action مكتشَف.
عدّل العنوان والأيقونة والمجموعة في اللوحة اليمنى ثم احفظ.

---

## 5. Editing the form layout / تعديل تخطيط النموذج

**English.** Form blocks support four layout types:

- **`grid`** — rows of N columns. Each row's `fields[]` listing assigns
  fields to that row.
- **`tabs`** — tabbed sections, each containing its own nested layout.
- **`sections`** — collapsible card sections, each with its own grid.
- **`split`** — two-column split (e.g. fields on the left, map on the
  right). Ratios: `50/50`, `60/40`, `70/30`.

Tabs / sections / split layouts are recursive — you can nest a `grid`
inside a `tab`, or a `split` whose right side contains a `sections`
layout.

**عربي.** بلوك النموذج يدعم أربعة تخطيطات:

- **شبكة (`grid`)** — صفوف، كل صف بعدد أعمدة محدَّد، الحقول تُسنَد
  للصف عبر `fields[]`.
- **تبويبات (`tabs`)** — أقسام تبويبية، كل واحدة لها تخطيطها الفرعي.
- **أقسام (`sections`)** — بطاقات قابلة للطيّ، كل واحدة بشبكتها.
- **انقسام (`split`)** — عمودين (مثلاً حقول يساراً وخريطة يميناً). النسب
  المتاحة: 50/50، 60/40، 70/30.

التبويبات والأقسام والانقسام تعاودية: يمكن وضع `grid` داخل `tab` أو
`split` يمينه `sections`.

---

## 6. Adding buttons / إضافة الأزرار

**English.** Three button positions:

- **`page-header`** — top of the page (e.g. "Create order").
- **`row`** — per row in a table (e.g. "Close ticket").
- **`form-footer`** — submit / cancel inside a form block.

Each button has an `action`:

- **`api`** — fires an HTTP call. Supports `confirm: { title, message,
  destructive }`, `onSuccess: { notify, refresh, navigate }`, and
  `onError: { notify }`. URL templates can interpolate `{id}`,
  `{entityId}`, or any custom token.
- **`navigate`** — client-side route change.
- **`dialog`** / **`drawer`** — open a modal containing nested blocks.
  *(Action execution for these lands in a future release.)*

**Example — close-ticket button:**

```json
{
  "id": "close-ticket",
  "label": { "en": "Close", "ar": "إغلاق" },
  "icon": "X",
  "variant": "destructive",
  "position": "row",
  "permission": "Api.Ticket.Close",
  "action": {
    "type": "api",
    "method": "POST",
    "endpoint": "/api/app/ticket/{id}/close",
    "confirm": {
      "title": { "en": "Close ticket?", "ar": "إغلاق التذكرة؟" },
      "message": { "en": "This cannot be undone.", "ar": "لا يمكن التراجع." },
      "destructive": true
    }
  },
  "rowCondition": { "field": "status", "operator": "ne", "value": "closed" }
}
```

The `rowCondition` makes the button auto-hide on rows where
`status === "closed"`.

**عربي.** ثلاث مواضع للأزرار: رأس الصفحة، صفّ الجدول، تذييل النموذج.
كل زر له `action`: `api` لاستدعاء HTTP (مع تأكيد + onSuccess/onError +
interpolation للـ {id})، `navigate` لتغيير المسار، أو `dialog` /
`drawer` لفتح مودال (الـ action للموادال يصل في إصدار لاحق). انظر
المثال أعلاه لزرّ إغلاق تذكرة.

---

## 7. Permissions / الصلاحيات

**English.** Every level supports an optional `permission` string in
`Api.<Module>.<Action>` shape:

- **Page** — `pageSchema.permission`. Without it the user sees a 403
  even via direct URL.
- **Block** — `block.permission`. Hides the block.
- **Field** — `field.permission`. Hides the field.
- **Button** — `button.permission`. Hides the button.

All checks go through the existing `PermissionContext` — admins bypass
everything by default.

**عربي.** كل مستوى يدعم حقل `permission` اختياري بنمط
`Api.<Module>.<Action>`. مستوى الصفحة، البلوك، الحقل، والزر — كل واحدة
تختفي عند غياب الصلاحية. الـ admin يتجاوز كل الفحوصات تلقائياً.

---

## 8. Translations / الترجمات

**English.** Every `{ en, ar }` pair in your schema is editable in two
places:

1. **Inline in the canvas PropertiesPanel** — quick iteration during
   build time.
2. **`/admin/translations`** under the `pages_dynamic` namespace — for
   bulk translation work or post-deploy edits without redeploy.

When you save a page, the canvas writes `pages_dynamic.<pageId>.title`
and friends to `messages/{en,ar}/pages_dynamic.json`. Translation editor
edits become i18n overrides on top.

**عربي.** كل `{ en, ar }` في الـ schema قابل للتعديل من مكانين:

1. **داخل اللوحة في PropertiesPanel** — للتعديل السريع وقت البناء.
2. **`/admin/translations`** في namespace `pages_dynamic` — للترجمة
   الجماعية أو التعديل بعد النشر دون حاجة لـ redeploy.

عند الحفظ تُكتب المفاتيح إلى `messages/{en,ar}/pages_dynamic.json`،
وتعديلات الـ translation editor تُطبَّق فوقها كـ overrides.

---

## 9. Sidebar registration / تسجيل القائمة الجانبية

**English.** A page appears in the sidebar when its `navigation` block
is set:

```json
"navigation": {
  "enabled": true,
  "group": "operations",
  "icon": "ShoppingCart",
  "order": 50
}
```

The `DynamicPagesSection` reads every saved page, filters by
`navigation.enabled === true` and the user's permission, then groups
and orders entries.

**عربي.** تظهر الصفحة في القائمة الجانبية عندما يُضبط `navigation` في
schema الصفحة (انظر أعلاه). الـ DynamicPagesSection يفلتر بـ
`enabled` + الصلاحية، ويجمع ويرتّب حسب `group` و `order`.

---

## 10. Materialize / تثبيت كمصدر

**English.** Once a page is final, **Materialize** promotes it from the
runtime override store to committed source files under
`src/app/(dashboard)/pages/<pageId>/`. Three files land:

- `page.tsx` — the route entry. Just imports `schema` and renders
  `<PageRenderer>`.
- `schema.ts` — the page schema as a typed const, validated through
  `pageSchema.parse(...)` at module load.
- `types.ts` — re-exports + the page-id literal.

Why bother? Because materialized pages:
- Pass `tsc` and the architectural validator at build time.
- Bundle their schema into the production build (no runtime override
  fetch).
- Survive override-store wipes.

**Requirements.**
- `APP_ALLOW_RUNTIME_CODEGEN=true` env (server) +
  `NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN=true` (client UI).
- The page must be saved (no unsaved changes).
- Any `custom` block's `componentName` must be in the registered
  allowlist (server-side).

The materialize button shows a confirm dialog explaining the disk
write. On success a banner lists every file written + the backup
snapshot ID under `.entity-builder-backups/<id>/`.

**عربي.** Materialize يحوّل الصفحة من الـ override-store إلى ملفات
TypeScript مُلتزَم بها تحت `src/app/(dashboard)/pages/<pageId>/`. تكتب
ثلاثة ملفات (`page.tsx` + `schema.ts` + `types.ts`). الفائدة: تمرّ عبر
`tsc` والمدقّق المعماري وقت البناء، ويُجمَّع الـ schema في bundle
الإنتاج، وتبقى ثابتة لو مُسحت ملفات الـ override. تتطلَّب تفعيل
`APP_ALLOW_RUNTIME_CODEGEN`، حفظ الصفحة، ومكوّن مسجَّل في الـ
allowlist لكل custom block.

---

## 11. Common pitfalls / أخطاء شائعة

| Symptom | Likely cause |
| :--- | :--- |
| Save returns 400 with Zod errors | Required field missing in JSON. The error issues list names the path. |
| 409 on save | A page with the same `id` already exists. Use a different `id` or delete the old one first. |
| Materialize button disabled | Either the env flag isn't set, or there are unsaved changes. |
| Materialize 422 (typecheck-failed) | The generated TS doesn't compile against the project tsconfig. The error list names every offending line. |
| Page disappears from sidebar | `navigation.enabled` is false or the viewer lacks `page.permission`. |

---

## 12. Where to go next / الخطوات التالية

- **Extending with a new block type** → see [`extending.md`](./extending.md).
- **Architecture deep-dive** → see [`architecture.md`](./architecture.md).
- **Schema reference** → see [`schema.md`](./schema.md).
