import { SpanStatusCode, trace } from "@opentelemetry/api";

export function createSpan(name: string) {
  return trace.getTracer("default").startSpan(name);
}

export async function withSpan<T>(spanName: string, fn: () => Promise<T>): Promise<T> {
  const span = createSpan(spanName);

  try {
    const result = await fn();
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message
    });
    if (error instanceof Error) {
      span.recordException(error);
    }
    throw error;
  } finally {
    span.end();
  }
}
