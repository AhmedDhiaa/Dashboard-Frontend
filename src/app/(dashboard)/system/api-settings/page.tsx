/**
 * API Settings Page
 * Manages global API settings with grouped sidebar navigation.
 */

"use client"

import { ApiSettingsForm } from "./ApiSettingsForm"

export default function ApiSettingsPage() {
  // The dashboard content well already provides the page padding; rendering the
  // form directly keeps gutters consistent with every other page.
  return <ApiSettingsForm />
}
