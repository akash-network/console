import { SpanStatusCode, trace } from "@opentelemetry/api";

/**
 * Decorator for tracing method execution
 * Automatically creates a span for the decorated method, tracks execution time,
 * and properly handles errors by setting the span status
 *
 * @example
 * ```typescript
 * class PaymentService {
 *   @Trace() // Uses class.method name as span name
 *   async processPayment(orderId: string) {
 *     // Method logic - tracing handled automatically
 *     return { success: true };
 *   }
 *
 *   @Trace('custom-validation-span') // With custom span name
 *   validateOrder(order: Order) {
 *     // Sync method - also works with tracing
 *     return order.isValid;
 *   }
 * }
 * ```
 *
 * @warning
 * **Use with caution:** TypeScript decorators remain experimental and unstable.
 * Legacy decorators may become a maintenance burden, while ECMAScript decorators
 * aren't fully standardized. Major frameworks are divided on decorator adoption.
 * Consider using `withSpan()` for more future-proof code.
 *
 * @param spanName - Optional custom span name, defaults to method name
 * @returns Method decorator
 */
export function Trace(spanName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodName = propertyKey;

    descriptor.value = function (...args: any[]) {
      const tracer = trace.getTracer("default");
      const name = spanName || `${target.constructor.name}.${methodName}`;

      const span = tracer.startSpan(name);

      try {
        if (originalMethod.constructor.name === "AsyncFunction" || originalMethod.toString().includes("return __awaiter")) {
          return originalMethod
            .apply(this, args)
            .then((result: any) => {
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();
              return result;
            })
            .catch((error: Error) => {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message
              });
              span.recordException(error);
              span.end();
              throw error;
            });
        }

        const result = originalMethod.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        span.recordException(error);
        span.end();
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Utility for manually creating and managing spans
 * Use this when you need fine-grained control over span lifecycle and attributes.
 *
 * @example
 * ```typescript
 * async function processItems(items: Item[]) {
 *   const span = createSpan('batch-processing');
 *
 *   try {
 *     // Add custom attributes to span
 *     span.setAttribute('items.count', items.length);
 *     span.setAttribute('process.type', 'bulk');
 *
 *     // Process items
 *     for (const item of items) {
 *       await processItem(item);
 *     }
 *
 *     // Set success status
 *     span.setStatus({ code: SpanStatusCode.OK });
 *   } catch (error) {
 *     // Record error details
 *     span.setStatus({
 *       code: SpanStatusCode.ERROR,
 *       message: error.message
 *     });
 *     span.recordException(error);
 *     throw error;
 *   } finally {
 *     // Always end the span
 *     span.end();
 *   }
 * }
 * ```
 *
 * @param name - Name of the span
 * @returns OpenTelemetry Span object
 */
export function createSpan(name: string) {
  return trace.getTracer("default").startSpan(name);
}

/**
 * Executes the provided function within a new span
 * Handles span lifecycle automatically, including error cases
 *
 * @example
 * ```typescript
 * // Simple usage
 * async function importData() {
 *   const result = await withSpan('data-import', async () => {
 *     // Complex operation logic
 *     const data = await fetchData();
 *     return processData(data);
 *   });
 *
 *   return result;
 * }
 *
 * // With span attributes
 * async function processOrder(orderId: string) {
 *   return withSpan('order-processing', async () => {
 *     // Get current span via context
 *     const span = trace.getSpan(context.active());
 *
 *     // Add attributes if needed
 *     if (span) {
 *       span.setAttribute('order.id', orderId);
 *     }
 *
 *     // Business logic
 *     return await orderService.process(orderId);
 *   });
 * }
 * ```
 *
 * @param spanName - Name of the span
 * @param fn - Function to execute within the span context
 * @returns Result of the function execution
 */
export async function withSpan<T>(spanName: string, fn: () => Promise<T>): Promise<T> {
  const span = createSpan(spanName);

  try {
    const result = await fn();
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
