import { ROOT_CONTEXT, SpanKind, trace, TraceFlags } from "@opentelemetry/api";
import { tracing } from "@opentelemetry/sdk-node";
import { describe, expect, it } from "vitest";

import { requestSampler } from "./request-sampler";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN_ID = "00f067aa0ba902b7";

describe("requestSampler", () => {
  it("records a request whose caller did not sample its own trace", () => {
    expect(decisionFor({ sampled: false, isRemote: true })).toBe(tracing.SamplingDecision.RECORD_AND_SAMPLED);
  });

  it("records a request whose caller sampled its own trace", () => {
    expect(decisionFor({ sampled: true, isRemote: true })).toBe(tracing.SamplingDecision.RECORD_AND_SAMPLED);
  });

  it("records a request that arrives without a trace", () => {
    expect(decisionFor()).toBe(tracing.SamplingDecision.RECORD_AND_SAMPLED);
  });

  it("keeps an in-process parent's decision not to sample", () => {
    expect(decisionFor({ sampled: false, isRemote: false })).toBe(tracing.SamplingDecision.NOT_RECORD);
  });

  function decisionFor(parent?: { sampled: boolean; isRemote: boolean }) {
    const context = parent
      ? trace.setSpanContext(ROOT_CONTEXT, {
          traceId: TRACE_ID,
          spanId: SPAN_ID,
          traceFlags: parent.sampled ? TraceFlags.SAMPLED : TraceFlags.NONE,
          isRemote: parent.isRemote
        })
      : ROOT_CONTEXT;

    return requestSampler.shouldSample(context, TRACE_ID, "POST /v1/deployments", SpanKind.SERVER, {}, []).decision;
  }
});
