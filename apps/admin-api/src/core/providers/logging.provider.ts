import { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { container } from "tsyringe";

container.register(HttpLoggerInterceptor, { useValue: new HttpLoggerInterceptor(LoggerService.forContext("HTTP")) });
