import { registerContextPropagation } from "@akashnetwork/instrumentation/testing";
import type { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { collectOtel } from "@akashnetwork/logging/otel";
import { describe, expect, it, onTestFinished } from "vitest";
import { mock } from "vitest-mock-extended";

import { createApp } from "./app";
import type { Container } from "./container";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

describe(createApp.name, () => {
  it("logs a request without the user and job ids its baggage names", async () => {
    const { app, logRecords } = setup();

    const response = await app.request("/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
        baggage: "user.id=baggage-marker,job.id=baggage-marker"
      },
      body: "{}"
    });

    expect(response.status).toBe(400);
    expect(logRecords).toEqual([expect.objectContaining({ traceId: TRACE_ID, httpRequest: expect.objectContaining({ status: 400 }) })]);
    expect(logRecords[0]).not.toHaveProperty("userId");
    expect(logRecords[0]).not.toHaveProperty("jobId");
  });

  function setup() {
    onTestFinished(registerContextPropagation());

    const logRecords: Record<string, unknown>[] = [];
    const recordAsWritten = (record: unknown) => {
      logRecords.push({ ...collectOtel(), ...(record as object) });
    };
    const httpLogger = mock<LoggerService>({ info: recordAsWritten, warn: recordAsWritten, error: recordAsWritten });
    const app = createApp(mock<Container>({ httpLoggerInterceptor: new HttpLoggerInterceptor(httpLogger) }));

    return { app, logRecords };
  }
});
