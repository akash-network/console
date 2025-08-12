import type { Span } from "@opentelemetry/api";
import { context } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";

export function traceActiveSpan<T extends (span: Span) => any>(name: string, callback: T): ReturnType<T> {
  return trace.getTracer("default").startActiveSpan(name, callback);
}

export function propagateTracingContext<T extends (...args: any[]) => any>(callback: T): T {
  const currentContext = context.active();
  return ((...args) => context.with(currentContext, () => callback(...args))) as T;
}
