import { LoggerService as LoggerServiceOriginal } from "@akashnetwork/logging";
import { HttpLoggerIntercepter } from "@akashnetwork/logging/hono";
import { context, trace } from "@opentelemetry/api";
import { container, injectable } from "tsyringe";

// Set up OpenTelemetry mixin for all LoggerService instances
// This collects trace information and adds it to log entries
LoggerServiceOriginal.mixin = () => {
  const currentSpan = trace.getSpan(context.active());
  return { ...currentSpan?.spanContext() };
};

container.register(HttpLoggerIntercepter, { useValue: new HttpLoggerIntercepter(LoggerServiceOriginal.forContext("HTTP")) });

@injectable()
export class LoggerService extends LoggerServiceOriginal {}
