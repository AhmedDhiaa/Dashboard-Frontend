/**
 * Seed value pools
 * ================
 *
 * Realistic, bilingual-ish demo values for the Iraqi ABP domain this dashboard
 * serves. Values are PICKED deterministically (by index/hash) — never randomly
 * — so output is stable. Arabic strings give the RTL UI something authentic to
 * render; IQD amounts and Iraqi cities/coords keep maps and money fields
 * plausible.
 *
 * These pools feed `field-factory.ts`, which maps a column/field path to one of
 * them based on the field name and column type.
 */

/** First names (Arabic) — used for person/employee/customer style fields. */
export const ARABIC_FIRST_NAMES = [
  "أحمد",
  "محمد",
  "علي",
  "حسين",
  "مصطفى",
  "عمر",
  "يوسف",
  "زينب",
  "فاطمة",
  "نور",
  "سارة",
  "مريم",
  "حسن",
  "كرار",
  "عباس",
  "رقية",
] as const

/** Family names (Arabic). */
export const ARABIC_LAST_NAMES = [
  "العبيدي",
  "الجبوري",
  "الحسني",
  "الكعبي",
  "الموسوي",
  "التميمي",
  "الدليمي",
  "الشمري",
  "البياتي",
  "الزيدي",
  "العامري",
  "الربيعي",
] as const


/** Iraqi cities (Arabic) with realistic centre coordinates. */
export const IRAQI_CITIES = [
  { ar: "بغداد", en: "Baghdad", lat: 33.3152, lng: 44.3661 },
  { ar: "البصرة", en: "Basra", lat: 30.5085, lng: 47.7835 },
  { ar: "الموصل", en: "Mosul", lat: 36.335, lng: 43.1189 },
  { ar: "أربيل", en: "Erbil", lat: 36.1911, lng: 44.0092 },
  { ar: "النجف", en: "Najaf", lat: 31.9962, lng: 44.3142 },
  { ar: "كربلاء", en: "Karbala", lat: 32.6149, lng: 44.0245 },
  { ar: "كركوك", en: "Kirkuk", lat: 35.4681, lng: 44.3922 },
  { ar: "الديوانية", en: "Diwaniyah", lat: 31.9923, lng: 44.9242 },
  { ar: "العمارة", en: "Amarah", lat: 31.8356, lng: 47.1448 },
  { ar: "الناصرية", en: "Nasiriyah", lat: 31.0539, lng: 46.2593 },
] as const

/** Country pool — Iraq + neighbours, the realistic spread for this app. */
export const COUNTRIES = [
  { ar: "العراق", en: "Iraq", code: "IQ" },
  { ar: "الكويت", en: "Kuwait", code: "KW" },
  { ar: "إيران", en: "Iran", code: "IR" },
  { ar: "تركيا", en: "Turkey", code: "TR" },
  { ar: "الأردن", en: "Jordan", code: "JO" },
  { ar: "السعودية", en: "Saudi Arabia", code: "SA" },
] as const

/** Company / business-partner names (Arabic). */
export const COMPANY_NAMES = [
  "شركة الرافدين للتجارة",
  "مجموعة بلاد ما بين النهرين",
  "شركة دجلة للنقل",
  "مؤسسة الفرات الصناعية",
  "شركة بابل للمواد الغذائية",
  "مجموعة النخيل التجارية",
  "شركة الخليج للخدمات",
  "مؤسسة أور للاستيراد",
  "شركة سومر للتوزيع",
  "مجموعة الزقورة القابضة",
] as const

/** Product / item names (Arabic). */
export const PRODUCT_NAMES = [
  "تمور المجدول",
  "زيت الزيتون البكر",
  "أرز العنبر",
  "دبس التمر",
  "عسل طبيعي",
  "طحين فاخر",
  "شاي العراق",
  "سكر ناعم",
  "ماء معدني",
  "معجون الطماطم",
  "بهارات مشكلة",
  "حليب مجفف",
] as const

/** Category names (Arabic). */
export const CATEGORY_NAMES = [
  "مواد غذائية",
  "مشروبات",
  "منظفات",
  "أدوات منزلية",
  "إلكترونيات",
  "ملابس",
  "قرطاسية",
  "مواد بناء",
] as const

/** Job titles (Arabic). */
export const JOB_TITLES = [
  "مدير عام",
  "محاسب",
  "مندوب مبيعات",
  "سائق",
  "أمين مخزن",
  "موظف استقبال",
  "مشرف عمليات",
  "فني صيانة",
] as const

/** Generic status enum used by `status` columns (id ↔ bilingual label). */
export const STATUS_ENUM = [
  { id: 1, en: "New", ar: "جديد" },
  { id: 2, en: "In Process", ar: "قيد المعالجة" },
  { id: 3, en: "Approved", ar: "تمت الموافقة" },
  { id: 4, en: "On The Way", ar: "في الطريق" },
  { id: 5, en: "Delivered", ar: "تم التسليم" },
  { id: 6, en: "Cancelled", ar: "ملغى" },
] as const

/** Notes / free-text remarks (Arabic). */
export const NOTES = [
  "تم التسليم بنجاح",
  "بانتظار الموافقة",
  "يرجى المتابعة",
  "ملاحظة داخلية",
  "تم التحقق من البيانات",
  "",
] as const

/** Street / address fragments (Arabic). */
export const STREETS = ["شارع الرشيد", "حي الجامعة", "المنصور", "الكرادة", "زيونة", "الدورة", "الكاظمية"] as const

/** Build a phone number deterministically from a numeric seed. */
export function iraqiPhone(seed: number): string {
  const prefixes = ["0770", "0771", "0780", "0781", "0790", "0750"]
  const prefix = prefixes[seed % prefixes.length]
  const rest = String(1000000 + (seed % 9000000)).padStart(7, "0")
  return `${prefix}${rest}`
}
