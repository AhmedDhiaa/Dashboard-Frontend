/**
 * Decide whether the translation editor writes to source files or to the
 * runtime override store.
 *
 * The server-side gate is APP_ALLOW_RUNTIME_CODEGEN — the same flag
 * that arms the entity-builder / page-builder / runtime-builder
 * materialize routes. The client mirrors it via the standard NEXT_PUBLIC
 * convention; the page-builder canvas reads the same variable for the
 * same reason. Both must be set for the editor to actually hit the
 * source-write endpoint (the route also returns 404 when the server flag
 * is off, so a stale client value just produces an error instead of an
 * insecure write).
 */

export type TranslationWriteMode = "source" | "overrides"

export const SOURCE_WRITE_ENABLED = process.env.NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN === "true"

export const WRITE_MODE: TranslationWriteMode = SOURCE_WRITE_ENABLED ? "source" : "overrides"
