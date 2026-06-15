/**
 * Enums handler
 * =============
 *
 * Serves `/api/app/enum/<enumType>` with the bilingual `EnumValue[]` shape the
 * enum service expects (`{ id, name, foreignName }`). Status/enum columns,
 * multi-select filters and badge renderers all resolve their labels from here.
 */

import type { EnumValue } from "@/core/enums/enum.types"

/** Build an EnumValue list from an array of [id, en, ar] tuples. */
function build(values: Array<[number, string, string]>): EnumValue[] {
  return values.map(([id, name, foreignName]) => ({ id, name, foreignName }))
}

/** All enum types the app references (see `enum.types.ts → EnumTypeName`). */
const ENUMS: Record<string, EnumValue[]> = {
  status: build([
    [1, "New", "جديد"],
    [2, "In Process", "قيد المعالجة"],
    [3, "Approved", "تمت الموافقة"],
    [4, "On The Way", "في الطريق"],
    [5, "Delivered", "تم التسليم"],
    [6, "Cancelled", "ملغى"],
  ]),
  "entity-type": build([
    [1, "Order", "طلب"],
    [2, "Invoice", "فاتورة"],
    [3, "Payment", "دفعة"],
    [4, "Vehicle", "مركبة"],
    [5, "Employee", "موظف"],
  ]),
  "user-one-time-password-type": build([
    [1, "Login", "تسجيل دخول"],
    [2, "Reset Password", "إعادة تعيين كلمة المرور"],
  ]),
  "amount-type": build([
    [1, "Debit", "مدين"],
    [2, "Credit", "دائن"],
  ]),
  "notification-type": build([
    [1, "Info", "معلومة"],
    [2, "Warning", "تحذير"],
    [3, "Alert", "تنبيه"],
  ]),
  "notification-status": build([
    [1, "Unread", "غير مقروء"],
    [2, "Read", "مقروء"],
  ]),
  "settlement-method": build([
    [1, "Cash", "نقدي"],
    [2, "Bank Transfer", "تحويل بنكي"],
    [3, "Wallet", "محفظة"],
  ]),
  "business-partner-type": build([
    [1, "Customer", "زبون"],
    [2, "Vendor", "مورّد"],
    [3, "Both", "كلاهما"],
  ]),
  "entity-change-type": build([
    [0, "Created", "إنشاء"],
    [1, "Updated", "تعديل"],
    [2, "Deleted", "حذف"],
  ]),
  "extra-charge-type": build([
    [1, "Fixed", "ثابت"],
    [2, "Percentage", "نسبة"],
  ]),
  "ticket-status": build([
    [1, "Open", "مفتوح"],
    [2, "Pending", "قيد الانتظار"],
    [3, "Resolved", "تم الحل"],
    [4, "Closed", "مغلق"],
  ]),
}

/** Return the enum values for a type, or an empty list for unknown types. */
export function enumResponse(enumType: string): EnumValue[] {
  return ENUMS[enumType] ?? []
}
