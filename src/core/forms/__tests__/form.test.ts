import { describe, it, expect } from "vitest"
import { validateFileUpload, formatFileSize, mapServerErrors } from "../utils"

describe("form utilities", () => {
  describe("validateFileUpload", () => {
    it("should allow valid file", () => {
      const file = new File(["content"], "test.pdf", { type: "application/pdf" })
      const error = validateFileUpload(file, 1024 * 1024, ["application/pdf"])
      expect(error).toBeNull()
    })

    it("should reject file exceeding max size", () => {
      const file = new File(["x".repeat(2000)], "large.pdf", { type: "application/pdf" })
      const error = validateFileUpload(file, 1000, ["application/pdf"])
      expect(error).toContain("must not exceed")
    })

    it("should reject file with wrong type", () => {
      const file = new File(["content"], "test.exe", { type: "application/x-msdownload" })
      const error = validateFileUpload(file, 1024 * 1024, ["application/pdf", "image/png"])
      expect(error).toContain("File type not accepted")
    })

    it("should accept wildcard types", () => {
      const file = new File(["content"], "test.png", { type: "image/png" })
      const error = validateFileUpload(file, 1024 * 1024, ["image/*"])
      expect(error).toBeNull()
    })
  })

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 Bytes")
      expect(formatFileSize(1024)).toBe("1 KB")
      expect(formatFileSize(1024 * 1024)).toBe("1 MB")
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB")
    })

    it("should handle decimal places", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB")
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB")
    })
  })

  describe("mapServerErrors", () => {
    it("should handle validation error array", () => {
      const serverError = [
        { field: "name", message: "Name is required" },
        { field: "email", message: "Email is invalid" },
      ]

      const errors = mapServerErrors(serverError)
      expect(errors).toEqual({
        name: ["Name is required"],
        email: ["Email is invalid"],
      })
    })

    it("should handle string error", () => {
      const errors = mapServerErrors("Something went wrong")
      expect(errors).toEqual({
        _general: ["Something went wrong"],
      })
    })

    it("should handle object errors", () => {
      const serverError = {
        name: ["Name is required"],
        email: ["Email is invalid"],
      }

      const errors = mapServerErrors(serverError)
      expect(errors).toEqual(serverError)
    })

    it("should handle undefined errors", () => {
      const errors = mapServerErrors(undefined)
      expect(errors).toEqual({})
    })
  })
})
