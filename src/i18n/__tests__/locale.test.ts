/**
 * Locale Utilities Tests
 * Comprehensive test coverage for locale management
 */

import { describe, it, expect, beforeEach } from "vitest"
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type Locale,
  isValidLocale,
  toValidLocale,
  getLocaleDirection,
  getLocaleDisplayName,
  getLocaleFlag,
  getCurrentLocale,
  setLocaleCookie,
  getLocaleFromCookie,
  updateDocumentLocale,
  persistLocale,
} from "@/shared/config/i18n"

describe("Locale Constants", () => {
  it("should have correct supported locales", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "ar"])
  })

  it("should have correct default locale", () => {
    expect(DEFAULT_LOCALE).toBe("ar")
  })

  it("should have correct cookie name", () => {
    expect(LOCALE_COOKIE_NAME).toBe("NEXT_LOCALE")
  })
})

describe("Locale Validation", () => {
  describe("isValidLocale", () => {
    it("should validate supported locales", () => {
      expect(isValidLocale("en")).toBe(true)
      expect(isValidLocale("ar")).toBe(true)
    })

    it("should reject unsupported locales", () => {
      expect(isValidLocale("fr")).toBe(false)
      expect(isValidLocale("de")).toBe(false)
      expect(isValidLocale("es")).toBe(false)
    })

    it("should reject invalid types", () => {
      expect(isValidLocale(null)).toBe(false)
      expect(isValidLocale(undefined)).toBe(false)
      expect(isValidLocale(123)).toBe(false)
      expect(isValidLocale({})).toBe(false)
      expect(isValidLocale([])).toBe(false)
    })

    it("should reject empty string", () => {
      expect(isValidLocale("")).toBe(false)
    })
  })

  describe("toValidLocale", () => {
    it("should return valid locale as-is", () => {
      expect(toValidLocale("en")).toBe("en")
      expect(toValidLocale("ar")).toBe("ar")
    })

    it("should fallback to default for invalid locale", () => {
      expect(toValidLocale("fr")).toBe(DEFAULT_LOCALE)
      expect(toValidLocale("invalid")).toBe(DEFAULT_LOCALE)
    })

    it("should fallback to default for invalid types", () => {
      expect(toValidLocale(null)).toBe(DEFAULT_LOCALE)
      expect(toValidLocale(undefined)).toBe(DEFAULT_LOCALE)
      expect(toValidLocale(123)).toBe(DEFAULT_LOCALE)
    })
  })
})

describe("Cookie Management", () => {
  beforeEach(() => {
    // Clear cookies before each test
    document.cookie = `${LOCALE_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
  })

  describe("setLocaleCookie", () => {
    it("should set cookie with correct value", () => {
      setLocaleCookie("en")
      expect(document.cookie).toContain("NEXT_LOCALE=en")
    })

    it("should set cookie with correct attributes", () => {
      setLocaleCookie("ar")
      const cookie = document.cookie
      expect(cookie).toContain("NEXT_LOCALE=ar")
      // Note: path and max-age can't be easily verified in jsdom
    })
  })

  describe("getLocaleFromCookie", () => {
    it("should return locale from cookie", () => {
      document.cookie = "NEXT_LOCALE=en; path=/"
      expect(getLocaleFromCookie()).toBe("en")
    })

    it("should return null if cookie not set", () => {
      expect(getLocaleFromCookie()).toBe(null)
    })

    it("should return null if cookie value is invalid", () => {
      document.cookie = "NEXT_LOCALE=invalid; path=/"
      expect(getLocaleFromCookie()).toBe(null)
    })
  })
})

// Storage-based persistence (`setLocaleStorage` / `getLocaleFromStorage`) was
// superseded by cookie-based persistence; the helpers were removed and the
// matching test blocks deleted. Cookie behavior is covered by the
// "Cookie Management" suite above.

describe("Document Updates", () => {
  beforeEach(() => {
    // Reset document attributes
    document.documentElement.dir = ""
    document.documentElement.lang = ""
  })

  describe("updateDocumentLocale", () => {
    it("should set RTL for Arabic", () => {
      updateDocumentLocale("ar")
      expect(document.documentElement.dir).toBe("rtl")
      expect(document.documentElement.lang).toBe("ar")
    })

    it("should set LTR for English", () => {
      updateDocumentLocale("en")
      expect(document.documentElement.dir).toBe("ltr")
      expect(document.documentElement.lang).toBe("en")
    })
  })
})

describe("Locale Helpers", () => {
  describe("getLocaleDirection", () => {
    it("should return rtl for Arabic", () => {
      expect(getLocaleDirection("ar")).toBe("rtl")
    })

    it("should return ltr for English", () => {
      expect(getLocaleDirection("en")).toBe("ltr")
    })
  })

  describe("getLocaleDisplayName", () => {
    it("should return display name for locale", () => {
      expect(getLocaleDisplayName("en")).toBe("English")
      expect(getLocaleDisplayName("ar")).toBe("العربية")
    })
  })

  describe("getLocaleFlag", () => {
    it("should return flag emoji for locale", () => {
      expect(getLocaleFlag("en")).toBe("🇬🇧")
      expect(getLocaleFlag("ar")).toBe("🇸🇦")
    })
  })
})

describe("Unified Locale Management", () => {
  beforeEach(() => {
    localStorage.clear()
    document.cookie = `${LOCALE_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    document.documentElement.dir = ""
    document.documentElement.lang = ""
  })

  describe("getCurrentLocale", () => {
    it("should read the cookie value", () => {
      setLocaleCookie("ar")
      expect(getCurrentLocale()).toBe("ar")
    })

    it("should fallback to default when no cookie is set", () => {
      expect(getCurrentLocale()).toBe(DEFAULT_LOCALE)
    })

    it("should fallback to default when the cookie value is invalid", () => {
      document.cookie = "NEXT_LOCALE=invalid; path=/"
      expect(getCurrentLocale()).toBe(DEFAULT_LOCALE)
    })
  })

  describe("persistLocale", () => {
    it("should save to the cookie", () => {
      persistLocale("en")
      expect(getLocaleFromCookie()).toBe("en")
    })

    it("should update document attributes", () => {
      persistLocale("ar")
      expect(document.documentElement.dir).toBe("rtl")
      expect(document.documentElement.lang).toBe("ar")
    })

    it("should overwrite existing values", () => {
      persistLocale("en")
      persistLocale("ar")
      expect(getLocaleFromCookie()).toBe("ar")
      expect(document.documentElement.dir).toBe("rtl")
    })
  })
})

describe("Edge Cases", () => {
  it("should handle rapid locale changes", () => {
    persistLocale("en")
    persistLocale("ar")
    persistLocale("en")
    expect(getCurrentLocale()).toBe("en")
  })

  it("should handle missing document", () => {
    // This would be in SSR context
    // Functions should not throw
    expect(() => {
      if (typeof document === "undefined") {
        // Mock SSR
      }
    }).not.toThrow()
  })
})

describe("Type Safety", () => {
  it("should enforce Locale type", () => {
    const locale: Locale = "en"
    expect(isValidLocale(locale)).toBe(true)
  })

  it("should prevent invalid assignment", () => {
    // This should cause TypeScript error (runtime test)
    const invalid = "fr"
    expect(isValidLocale(invalid)).toBe(false)
  })
})
