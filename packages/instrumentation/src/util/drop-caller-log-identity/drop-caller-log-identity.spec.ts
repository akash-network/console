import type { Baggage, SpanContext } from "@opentelemetry/api";
import { context, propagation, ROOT_CONTEXT, trace, TraceFlags } from "@opentelemetry/api";
import { describe, expect, it, onTestFinished } from "vitest";

import { registerContextPropagation } from "../../testing/register-context-propagation";
import { dropCallerLogIdentity } from "./drop-caller-log-identity";

const CALLER_SPAN_CONTEXT: SpanContext = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  traceFlags: TraceFlags.SAMPLED,
  isRemote: true
};

describe(dropCallerLogIdentity.name, () => {
  it("removes the user and job ids the caller put in the baggage", async () => {
    const { runRequest } = setup({ baggage: { "user.id": "caller-user", "job.id": "caller-job" } });

    const { baggage } = await runRequest();

    expect(baggage?.getEntry("user.id")).toBeUndefined();
    expect(baggage?.getEntry("job.id")).toBeUndefined();
  });

  it("keeps the other baggage entries the caller sent", async () => {
    const { runRequest } = setup({ baggage: { "user.id": "caller-user", "session.region": "eu" } });

    const { baggage } = await runRequest();

    expect(baggage?.getAllEntries()).toEqual([["session.region", { value: "eu" }]]);
  });

  it("keeps the trace context of the request", async () => {
    const { runRequest } = setup({ baggage: { "job.id": "caller-job" } });

    const { spanContext } = await runRequest();

    expect(spanContext).toEqual(CALLER_SPAN_CONTEXT);
  });

  it("runs the request without baggage when the caller sent none", async () => {
    const { runRequest } = setup({});

    const { baggage, spanContext } = await runRequest();

    expect(baggage).toBeUndefined();
    expect(spanContext).toEqual(CALLER_SPAN_CONTEXT);
  });

  it("returns what the rest of the request returns", async () => {
    const { runRequest } = setup({ baggage: { "user.id": "caller-user" } });

    const { result } = await runRequest();

    expect(result).toBe("response");
  });

  function setup(input: { baggage?: Record<string, string> }) {
    onTestFinished(registerContextPropagation());

    const spanContext = trace.setSpanContext(ROOT_CONTEXT, CALLER_SPAN_CONTEXT);
    const requestContext = input.baggage
      ? propagation.setBaggage(
          spanContext,
          propagation.createBaggage(Object.fromEntries(Object.entries(input.baggage).map(([key, value]) => [key, { value }])))
        )
      : spanContext;

    async function runRequest() {
      let seen: { baggage?: Baggage; spanContext?: SpanContext } = {};
      const result = await context.with(requestContext, () =>
        dropCallerLogIdentity(undefined, async () => {
          seen = { baggage: propagation.getBaggage(context.active()), spanContext: trace.getSpanContext(context.active()) };
          return "response";
        })
      );

      return { ...seen, result };
    }

    return { runRequest };
  }
});
