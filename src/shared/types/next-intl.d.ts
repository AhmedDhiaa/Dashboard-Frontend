/**
 * Type-safe i18n configuration for next-intl
 *
 * This file provides TypeScript autocomplete and type checking for translation keys
 */

import type en from "@/messages/en/common.json"

type Messages = typeof en

declare global {
  // Use type safe message keys with `next-intl`
  type IntlMessages = Messages
}
