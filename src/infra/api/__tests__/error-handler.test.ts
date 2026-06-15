import { describe, it, expect, vi } from "vitest"
import { createAppError, handleError, getErrorInfo } from "../error-handling"
import { AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError } from "../errors"

describe("error-handler", () => {
  describe("createAppError", () => {
    it("should create ValidationError for 400 status", () => {
      const error = createAppError(400, "Validation failed", "VALIDATION_ERROR")
      expect(error).toBeInstanceOf(ValidationError)
      expect(error.message).toBe("Validation failed")
      expect(error.code).toBe("VALIDATION_ERROR")
    })

    it("should create AuthenticationError for 401 status", () => {
      const error = createAppError(401, "Unauthorized", "UNAUTHORIZED")
      expect(error).toBeInstanceOf(AuthenticationError)
      expect(error.message).toBe("Unauthorized")
    })

    it("should create AuthorizationError for 403 status", () => {
      const error = createAppError(403, "Forbidden", "FORBIDDEN")
      expect(error).toBeInstanceOf(AuthorizationError)
      expect(error.message).toBe("Forbidden")
    })

    it("should create NotFoundError for 404 status", () => {
      // NotFoundError synthesizes its message from the resource it extracts.
      // Just assert the type and that the message references the resource.
      const error = createAppError(404, "Order not found", "NOT_FOUND")
      expect(error).toBeInstanceOf(NotFoundError)
      expect(error.message.toLowerCase()).toContain("not found")
    })

    it("should create generic AppError for other status codes", () => {
      const error = createAppError(500, "Server error", "SERVER_ERROR")
      expect(error).toBeInstanceOf(AppError)
      expect(error.statusCode).toBe(500)
      expect(error.message).toBe("Server error")
    })

    it("should include details in error", () => {
      const details = { field: "email", reason: "invalid format" }
      const error = createAppError(400, "Validation failed", "VALIDATION_ERROR", details)
      expect(error.details).toEqual(details)
    })
  })

  describe("handleError", () => {
    it("should handle AppError", () => {
      const error = new AppError("Test error", "TEST_ERROR", 500)
      const result = handleError(error)

      expect(result.message).toBe("Test error")
      expect(result.code).toBe("TEST_ERROR")
      expect(result.shouldRedirect).toBe(false)
    })

    it("should handle AuthenticationError with redirect", () => {
      const error = new AuthenticationError("Login required")
      const result = handleError(error)

      expect(result.shouldRedirect).toBe(true)
      expect(result.redirectTo).toBe("/auth/login")
    })

    it("should handle AuthorizationError with redirect", () => {
      const error = new AuthorizationError("Access denied")
      const result = handleError(error)

      expect(result.shouldRedirect).toBe(true)
      expect(result.redirectTo).toBe("/403")
    })

    it("should handle network errors", () => {
      const error = new Error("Network error occurred")
      const result = handleError(error)

      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.shouldRedirect).toBe(false)
    })

    it("should handle generic errors", () => {
      const error = new Error("Something went wrong")
      const result = handleError(error)

      expect(result.message).toBe("Something went wrong")
      expect(result.code).toBe("UNKNOWN_ERROR")
    })

    it("should handle unknown types", () => {
      const result = handleError("String error")

      expect(result.message).toBe("String error")
      expect(result.code).toBe("UNKNOWN_ERROR")
    })
  })

  describe("getErrorInfo", () => {
    it("should extract info from AppError", () => {
      const error = new AppError("Test error", "TEST_ERROR", 500)
      const info = getErrorInfo(error)

      expect(info.title).toBe("TEST ERROR")
      expect(info.message).toBe("Test error")
      expect(info.canRetry).toBe(true)
    })

    it("should mark AuthenticationError as non-retryable", () => {
      const error = new AuthenticationError("Login required")
      const info = getErrorInfo(error)

      expect(info.canRetry).toBe(false)
    })

    it("should mark AuthorizationError as non-retryable", () => {
      const error = new AuthorizationError("Access denied")
      const info = getErrorInfo(error)

      expect(info.canRetry).toBe(false)
    })

    it("should handle generic Error", () => {
      const error = new Error("Generic error")
      const info = getErrorInfo(error)

      expect(info.title).toBe("Application Error")
      expect(info.message).toBe("Generic error")
      expect(info.canRetry).toBe(true)
    })

    it("should include stack in development mode", () => {
      // Use vi.stubEnv since process.env entries are typed as readonly here.
      vi.stubEnv("NODE_ENV", "development")
      try {
        const error = new Error("Test error")
        error.stack = "Error stack trace"
        const info = getErrorInfo(error)
        expect(info.stack).toBeDefined()
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })
})
