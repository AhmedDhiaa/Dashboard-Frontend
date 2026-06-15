/**
 * Curated lucide-icon picker source for the materialize summary card.
 *
 * Hard rule: every icon is imported BY NAME. Doing
 *
 *     import * as Icons from "lucide-react"
 *
 * would pull every icon (~1000+, ~1MB) into the materialize-dialog
 * client chunk. By-name imports get tree-shaken to roughly 300-500
 * bytes per icon, keeping the chunk under the 15KB bundle-guard
 * budget set for this Part.
 *
 * 20-icon cap is the bundle guard. To add a 21st, you must first
 * remove one — otherwise the chunk grows past the cap.
 */

import {
  Box,
  Users,
  Package,
  Settings,
  Truck,
  ShoppingCart,
  Database,
  FileText,
  BarChart,
  MapPin,
  DollarSign,
  ClipboardList,
  Globe,
  Layers,
  Shield,
  Bell,
  Star,
  Tag,
  Briefcase,
  Calendar,
  type LucideIcon,
} from "lucide-react"

export interface MaterializeIconOption {
  name: string
  Icon: LucideIcon
}

export const MATERIALIZE_ICONS: readonly MaterializeIconOption[] = [
  { name: "Box", Icon: Box },
  { name: "Users", Icon: Users },
  { name: "Package", Icon: Package },
  { name: "Settings", Icon: Settings },
  { name: "Truck", Icon: Truck },
  { name: "ShoppingCart", Icon: ShoppingCart },
  { name: "Database", Icon: Database },
  { name: "FileText", Icon: FileText },
  { name: "BarChart", Icon: BarChart },
  { name: "MapPin", Icon: MapPin },
  { name: "DollarSign", Icon: DollarSign },
  { name: "ClipboardList", Icon: ClipboardList },
  { name: "Globe", Icon: Globe },
  { name: "Layers", Icon: Layers },
  { name: "Shield", Icon: Shield },
  { name: "Bell", Icon: Bell },
  { name: "Star", Icon: Star },
  { name: "Tag", Icon: Tag },
  { name: "Briefcase", Icon: Briefcase },
  { name: "Calendar", Icon: Calendar },
] as const

export const MATERIALIZE_ICON_NAMES: readonly string[] = MATERIALIZE_ICONS.map(i => i.name)

/** "purchase-invoice" → "PurchaseInvoice". Used to derive the default permission key. */
export function kebabToPascal(kebab: string): string {
  return kebab
    .split(/[-_]+/)
    .filter(Boolean)
    .map(seg => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join("")
}
