import { context, propagation, trace } from "@opentelemetry/api";
import { node, tracing } from "@opentelemetry/sdk-node";

/** Installs the async context manager and the W3C trace context and baggage propagators that the SDK installs at startup. */
export function registerContextPropagation(): () => Promise<void> {
  return registerTracerProvider(new node.NodeTracerProvider());
}

/** Registers what {@link registerContextPropagation} does and also keeps every span that ends, so a test can read what was recorded. */
export function recordFinishedSpans(): { finishedSpans: () => tracing.ReadableSpan[]; unregister: () => Promise<void> } {
  const spanExporter = new tracing.InMemorySpanExporter();
  const unregister = registerTracerProvider(new node.NodeTracerProvider({ spanProcessors: [new tracing.SimpleSpanProcessor(spanExporter)] }));

  return { finishedSpans: () => spanExporter.getFinishedSpans(), unregister };
}

function registerTracerProvider(tracerProvider: node.NodeTracerProvider): () => Promise<void> {
  tracerProvider.register();

  return async function unregisterContextPropagation() {
    await tracerProvider.shutdown();
    trace.disable();
    propagation.disable();
    context.disable();
  };
}
