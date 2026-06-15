/**
 * Axios Type Augmentation
 * Extends Axios types to include custom metadata
 */

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime?: number
      /**
       * Per-request correlation ID. Set by the request interceptor, sent as
       * `x-correlation-id` header, attached to every log line, and surfaced
       * on `AppError.correlationId` for cross-stack debugging.
       */
      correlationId?: string
      [key: string]: unknown
    }
  }
}

export {}
