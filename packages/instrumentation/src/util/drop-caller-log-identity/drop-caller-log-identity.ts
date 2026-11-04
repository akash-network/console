import { context, propagation } from "@opentelemetry/api";

const LOG_IDENTITY_BAGGAGE_KEYS = ["user.id", "job.id"];

/** Mount it after `otel()`, which extracts the caller's baggage again whenever the request has a traceparent header. */
export function dropCallerLogIdentity<T>(_: unknown, next: () => Promise<T>): Promise<T> {
  const requestContext = context.active();
  const callerBaggage = propagation.getBaggage(requestContext);

  if (!callerBaggage) {
    return next();
  }

  const baggage = callerBaggage.removeEntries(...LOG_IDENTITY_BAGGAGE_KEYS);

  return context.with(propagation.setBaggage(requestContext, baggage), next);
}
