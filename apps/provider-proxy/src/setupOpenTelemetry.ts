import { LoggerService } from "@akashnetwork/logging";
import { context, trace } from "@opentelemetry/api";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";

registerInstrumentations({
  instrumentations: [new HttpInstrumentation()]
});

LoggerService.mixin = () => {
  const currentSpan = trace.getSpan(context.active());
  return { ...currentSpan?.spanContext() };
};
