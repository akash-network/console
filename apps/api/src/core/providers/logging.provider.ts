import { LoggerService as LoggerServiceOriginal } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { collectOtel } from "@akashnetwork/logging/otel";
import { container, injectable } from "tsyringe";

// Set up OpenTelemetry mixin for all LoggerService instances
// This collects trace information and adds it to log entries
LoggerServiceOriginal.mixin = collectOtel;

container.register(HttpLoggerInterceptor, { useValue: new HttpLoggerInterceptor(LoggerServiceOriginal.forContext("HTTP")) });

@injectable()
export class LoggerService extends LoggerServiceOriginal {}
