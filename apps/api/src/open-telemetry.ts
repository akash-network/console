import { LoggerService } from "@akashnetwork/logging";
import { context, trace } from "@opentelemetry/api";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

new NodeTracerProvider().register();

registerInstrumentations({
  instrumentations: [new HttpInstrumentation(), new PinoInstrumentation()]
});

LoggerService.mixin = () => {
  const currentSpan = trace.getSpan(context.active());
  return { ...currentSpan?.spanContext() };
};
