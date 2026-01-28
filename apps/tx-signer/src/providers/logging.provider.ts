import { LoggerService as LoggerServiceOriginal } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { collectOtel, createOtelLogger } from "@akashnetwork/logging/otel";
import { container, injectable } from "tsyringe";

container.register(HttpLoggerInterceptor, { useValue: new HttpLoggerInterceptor(createOtelLogger({ context: "HTTP" })) });

@injectable()
export class LoggerService extends LoggerServiceOriginal {
  constructor() {
    super({ mixin: collectOtel });
  }
}
