/**
 * Unified application logger.
 *
 * Single logger for every layer (shared / core / infra / features / UI).
 * Console transport always; an optional remote transport batches to
 * `NEXT_PUBLIC_LOG_ENDPOINT` when set in the browser.
 *
 * Output format: `[<ISO timestamp>] [<LEVEL>] <message> [...args]`.
 *
 * Level gating uses `NEXT_PUBLIC_LOG_LEVEL` (default "info"). In production,
 * set `NEXT_PUBLIC_LOG_LEVEL=warn` to drop debug/info noise; `silent` drops
 * everything (used by the test runner so passing suites don't print app logs).
 */

/* eslint-disable no-console */

/** Levels that actually emit output (each maps 1:1 to a `console` method). */
export type LoggableLevel = "debug" | "info" | "warn" | "error"
/** Configurable threshold. `silent` is a gate-only value — it disables all
 *  output and is never passed to a transport. */
export type LogLevel = LoggableLevel | "silent"

export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

interface LogTransport {
  log(level: LoggableLevel, message: string, args: unknown[]): void
}

class ConsoleTransport implements LogTransport {
  log(level: LoggableLevel, message: string, args: unknown[]) {
    const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`
    console[level](prefix, message, ...args)
  }
}

interface LogEntry {
  level: LoggableLevel
  message: string
  args: unknown[]
  ts: number
}

class RemoteTransport implements LogTransport {
  private endpoint: string
  private buffer: LogEntry[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(endpoint: string) {
    this.endpoint = endpoint
  }

  log(level: LoggableLevel, message: string, args: unknown[]) {
    this.buffer.push({ level, message, args, ts: Date.now() })
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 2000)
    }
  }

  private async flush() {
    if (!this.buffer.length) return
    const batch = this.buffer.splice(0)
    this.flushTimer = null
    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        keepalive: true,
      })
    } catch {
      // silently fail — never crash the app due to logging
    }
  }
}

class LoggerImpl implements Logger {
  private transports: LogTransport[]
  private minLevel: LogLevel
  private readonly levels: LoggableLevel[] = ["debug", "info", "warn", "error"]

  constructor() {
    this.minLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel | undefined) ?? "info"
    this.transports = [new ConsoleTransport()]
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_LOG_ENDPOINT) {
      this.transports.push(new RemoteTransport(process.env.NEXT_PUBLIC_LOG_ENDPOINT))
    }
  }

  private shouldLog(level: LoggableLevel): boolean {
    if (this.minLevel === "silent") return false
    return this.levels.indexOf(level) >= this.levels.indexOf(this.minLevel)
  }

  private emit(level: LoggableLevel, message: string, args: unknown[]) {
    if (!this.shouldLog(level)) return
    this.transports.forEach(t => t.log(level, message, args))
  }

  debug(message: string, ...args: unknown[]) {
    this.emit("debug", message, args)
  }
  info(message: string, ...args: unknown[]) {
    this.emit("info", message, args)
  }
  warn(message: string, ...args: unknown[]) {
    this.emit("warn", message, args)
  }
  error(message: string, ...args: unknown[]) {
    this.emit("error", message, args)
  }
}

export const logger: Logger = new LoggerImpl()
