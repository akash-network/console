import { context, propagation, trace } from "@opentelemetry/api";
import { node } from "@opentelemetry/sdk-node";

/** Installs the async context manager and the W3C trace context and baggage propagators that the SDK installs at startup. */
export function registerContextPropagation(): () => Promise<void> {
  const tracerProvider = new node.NodeTracerProvider();
  tracerProvider.register();

  return async function unregisterContextPropagation() {
    await tracerProvider.shutdown();
    trace.disable();
    propagation.disable();
    context.disable();
  };
}
