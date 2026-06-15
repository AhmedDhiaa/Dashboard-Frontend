/**
 * Dashboard handler
 * =================
 *
 * Seeds the `/api/app/dashboard/*` count endpoints the executive overview and
 * financial/operations widgets consume (see
 * `src/features/dashboard/services/dashboard.service.ts`). Each response matches
 * the exact type in `dashboard.types.ts` so KPI cards, status breakdowns and
 * the small charts render with plausible numbers.
 *
 * Numbers are deterministic per endpoint (seeded by the URL) so the dashboard
 * is stable between renders but still looks like a real, varied dataset.
 */

import { SeededRandom } from "../prng"

/** Build an EntityStatusStats-shaped object with a coherent breakdown. */
function statusStats(rng: SeededRandom, total: number) {
  const split = () => rng.int(1, Math.max(2, Math.floor(total / 5)))
  return {
    total,
    totalNew: split(),
    totalInProcess: split(),
    totalApproved: split(),
    totalDriverAppointed: split(),
    totalOnTheWay: split(),
    totalArrived: split(),
    totalDelivered: split(),
    totalCompleted: split(),
    totalPaid: split(),
    totalPending: split(),
    totalRejected: split(),
    totalCancelled: split(),
  }
}

/** Map a dashboard sub-path to its seeded response payload. */
export function dashboardResponse(subPath: string): unknown {
  const rng = new SeededRandom(`dashboard:${subPath}`)

  switch (subPath) {
    case "business-partner-count": {
      const totalCustomer = rng.int(120, 600)
      const totalVendor = rng.int(30, 200)
      return { count: { total: totalCustomer + totalVendor, totalCustomer, totalVendor } }
    }
    case "employee-count":
      return {
        count: { total: rng.int(40, 160) },
        jobTitles: ["مدير", "محاسب", "مندوب", "سائق", "أمين مخزن"].map(key => ({
          key,
          count: { total: rng.int(3, 40) },
        })),
      }
    case "vehicle-count": {
      const totalWarehouse = rng.int(10, 50)
      const totalNotWarehouse = rng.int(20, 90)
      return { count: { total: totalWarehouse + totalNotWarehouse, totalWarehouse, totalNotWarehouse } }
    }
    case "order-count":
      return {
        count: statusStats(rng, rng.int(400, 2000)),
        countries: [
          {
            key: "العراق",
            count: statusStats(rng, rng.int(300, 1500)),
            cities: ["بغداد", "البصرة", "أربيل"].map(city => ({
              key: city,
              count: statusStats(rng, rng.int(50, 400)),
              areas: ["الكرادة", "المنصور"].map(area => ({
                key: area,
                count: statusStats(rng, rng.int(10, 120)),
              })),
            })),
          },
        ],
      }
    case "sales-invoice-count":
    case "payment-count":
    case "receive-count": {
      const count = statusStats(rng, rng.int(200, 1200))
      const amount = statusStats(rng, rng.int(5_000_000, 250_000_000))
      return { count, amount }
    }
    case "ticket-count": {
      const totalOpen = rng.int(5, 60)
      const totalClosed = rng.int(40, 300)
      return { count: { total: totalOpen + totalClosed, totalOpen, totalClosed } }
    }
    case "product-count":
      return {
        count: { total: rng.int(200, 900) },
        categories: ["مواد غذائية", "مشروبات", "منظفات", "إلكترونيات"].map(key => ({
          key,
          count: { total: rng.int(20, 200) },
        })),
      }
    case "sales-invoice-item-count":
      return {
        count: { total: rng.int(500, 3000) },
        items: ["تمور", "زيت", "أرز", "عسل", "شاي"].map(key => ({
          key,
          count: { total: rng.int(30, 400) },
        })),
      }
    default:
      // Unknown dashboard sub-path — a harmless empty count keeps callers safe.
      return { count: { total: rng.int(10, 500) } }
  }
}
