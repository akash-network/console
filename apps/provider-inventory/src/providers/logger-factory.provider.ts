import type { CreateLogger } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { InjectionToken } from "tsyringe";
import { container, instanceCachingFactory } from "tsyringe";

export type LoggerFactory = CreateLogger;
export const LOGGER_FACTORY = Symbol("LOGGER_FACTORY") as InjectionToken<LoggerFactory>;

container.register(LOGGER_FACTORY, { useValue: createOtelLogger });
container.register(HttpLoggerInterceptor, {
  useFactory: instanceCachingFactory(c => new HttpLoggerInterceptor(c.resolve(LOGGER_FACTORY)({ context: "HTTP" })))
});
