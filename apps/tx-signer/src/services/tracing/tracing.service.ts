import { context, SpanStatusCode, trace } from "@opentelemetry/api";

export function createSpan(name: string) {
  return trace.getTracer("default").startSpan(name);
}

export async function withSpan<T>(spanName: string, fn: () => Promise<T>): Promise<T> {
  const span = createSpan(spanName);
  const spanContext = trace.setSpan(context.active(), span);

  try {
    const result = await context.with(spanContext, fn);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error: unknown) {
    const exception = error instanceof Error ? error : new Error(String(error));
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: exception.message
    });
    span.recordException(exception);
    throw error;
  } finally {
    span.end();
  }
}
