import { SpanKind } from "@akashnetwork/instrumentation";
import { recordFinishedSpans } from "@akashnetwork/instrumentation/testing";
import type { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { collectOtel } from "@akashnetwork/logging/otel";
import { describe, expect, it, onTestFinished } from "vitest";
import { mock } from "vitest-mock-extended";

import { WebsocketStats } from "./services/WebsocketStats";
import { createApp } from "./app";
import type { Container } from "./container";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const CALLER_SPAN_ID = "00f067aa0ba902b7";

describe(createApp.name, () => {
  it("logs a request without the user and job ids its baggage names", async () => {
    const { app, logRecords } = setup();

    const response = await app.request("/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        traceparent: `00-${TRACE_ID}-${CALLER_SPAN_ID}-01`,
        baggage: "user.id=baggage-marker,job.id=baggage-marker"
      },
      body: "{}"
    });

    expect(response.status).toBe(400);
    expect(logRecords).toEqual([expect.objectContaining({ traceId: TRACE_ID, httpRequest: expect.objectContaining({ status: 400 }) })]);
    expect(logRecords[0]).not.toHaveProperty("userId");
    expect(logRecords[0]).not.toHaveProperty("jobId");
  });

  it("records each traced request as a span of the caller's trace with no request headers among its attributes", async () => {
    const { app, finishedSpans } = setup();
    const tracedRequest = {
      headers: { traceparent: `00-${TRACE_ID}-${CALLER_SPAN_ID}-01`, tracestate: "vendor=marker", baggage: "session.region=eu" }
    };

    await app.request("/status", tracedRequest);
    await app.request("/status", tracedRequest);
    await app.request("/status", tracedRequest);

    const recordedSpans = finishedSpans().map(span => ({
      kind: span.kind,
      traceId: span.spanContext().traceId,
      parentSpanId: span.parentSpanContext?.spanId,
      requestHeaderAttributes: Object.keys(span.attributes).filter(name => name.startsWith("http.request.header."))
    }));
    expect(recordedSpans).toEqual(Array(3).fill({ kind: SpanKind.SERVER, traceId: TRACE_ID, parentSpanId: CALLER_SPAN_ID, requestHeaderAttributes: [] }));
  });

  function setup() {
    const { finishedSpans, unregister } = recordFinishedSpans();
    onTestFinished(unregister);

    const logRecords: Record<string, unknown>[] = [];
    const recordAsWritten = (record: unknown) => {
      logRecords.push({ ...collectOtel(), ...(record as object) });
    };
    const httpLogger = mock<LoggerService>({ info: recordAsWritten, warn: recordAsWritten, error: recordAsWritten });
    const app = createApp(mock<Container>({ httpLoggerInterceptor: new HttpLoggerInterceptor(httpLogger), wsStats: new WebsocketStats() }));

    return { app, logRecords, finishedSpans };
  }
});
