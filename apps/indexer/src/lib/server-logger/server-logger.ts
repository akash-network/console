export type ServerLogMessage = Record<string, unknown> & { event: string; error?: unknown };

/**
 * Structural subset of `LoggerService` so server lifecycle helpers stay decoupled
 * from the logging package and remain trivial to fake in tests.
 */
export interface ServerLogger {
  info(message: ServerLogMessage): void;
  error(message: ServerLogMessage): void;
}
