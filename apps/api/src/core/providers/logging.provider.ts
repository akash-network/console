import { LoggerService as LoggerServiceOriginal } from "@akashnetwork/logging";
import { HttpLoggerIntercepter } from "@akashnetwork/logging/hono";
import { container, injectable } from "tsyringe";

container.register(HttpLoggerIntercepter, { useValue: new HttpLoggerIntercepter(LoggerServiceOriginal.forContext("HTTP")) });

@injectable()
export class LoggerService extends LoggerServiceOriginal {}
