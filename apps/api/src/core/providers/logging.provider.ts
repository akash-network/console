import type { CreateLogger } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

container.register(HttpLoggerInterceptor, { useValue: new HttpLoggerInterceptor(createOtelLogger({ context: "HTTP" })) });

export type { CreateLogger };
export const LOGGER_FACTORY = Symbol("LOGGER_FACTORY") as InjectionToken<typeof createOtelLogger>;
container.register(LOGGER_FACTORY, { useValue: createOtelLogger });
