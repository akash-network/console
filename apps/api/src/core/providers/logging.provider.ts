import { type CreateLogger, LoggerService as LoggerServiceOriginal } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { collectOtel, createOtelLogger } from "@akashnetwork/logging/otel";
import { container, injectable, InjectionToken } from "tsyringe";

container.register(HttpLoggerInterceptor, { useValue: new HttpLoggerInterceptor(createOtelLogger({ context: "HTTP" })) });

/**
 * Registered in DI as injectable service, so we get new instance on every injection.
 * @deprecated use `LOGGER_FACTORY` token instead
 */
@injectable()
export class LoggerService extends LoggerServiceOriginal {
  constructor() {
    super({ mixin: collectOtel });
  }
}

export type { CreateLogger };
export const LOGGER_FACTORY = Symbol("LOGGER_FACTORY") as InjectionToken<typeof createOtelLogger>;
container.register(LOGGER_FACTORY, { useValue: createOtelLogger });
