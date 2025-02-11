import { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerIntercepter } from "@akashnetwork/logging/hono";
import { container } from "tsyringe";

container.register(HttpLoggerIntercepter, { useValue: new HttpLoggerIntercepter(LoggerService.forContext("HTTP")) });
