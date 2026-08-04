export type ServerLogMessage = Record<string, unknown> & { event: string; error?: unknown };

/**
 * Structural subset of `LoggerService` so server lifecycle helpers stay usable
 * in apps without a logging package wired in — `console` satisfies it as is.
 */
export interface ServerLogger {
  info(message: ServerLogMessage): void;
  error(message: ServerLogMessage): void;
}
