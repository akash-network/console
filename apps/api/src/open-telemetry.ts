import { LoggerService } from "@akashnetwork/logging";
import { context, trace } from "@opentelemetry/api";

LoggerService.mixin = () => {
  const currentSpan = trace.getSpan(context.active());
  return { ...currentSpan?.spanContext() };
};
