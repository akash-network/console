import { context, SpanStatusCode, trace } from "@akashnetwork/instrumentation";
import { recordFinishedSpans } from "@akashnetwork/instrumentation/testing";
import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it, onTestFinished } from "vitest";

import { POSTGRES_DB } from "./postgres.provider";

describe("postgres.js query tracing", () => {
  it("records each query as one child span of the span that issued it, without its bound values", async () => {
    const { db, finishedQuerySpans } = setup();
    const parent = trace.getTracer("test").startSpan("GET /v1/user");

    await context.with(trace.setSpan(context.active(), parent), async () => {
      await db.execute(sql`select ${"user-secret-token"}::text as token`);
    });

    expect(finishedQuerySpans()).toHaveLength(1);
    const [span] = finishedQuerySpans();
    expect(span.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
    expect(span.name).toMatch(/^SELECT /);
    expect(span.attributes).toMatchObject({
      "db.system.name": "postgresql",
      "db.query.text": "select $1::text as token",
      "db.operation.name": "SELECT",
      "db.response.returned_rows": 1
    });
    expect(JSON.stringify(span.attributes)).not.toContain("user-secret-token");
  });

  it("records a query the server rejects as a failed span, without the value it rejected", async () => {
    const { db, finishedQuerySpans } = setup();

    await expect(inRequestSpan(() => db.execute(sql`select ${"user-secret-token"}::uuid`))).rejects.toThrow();

    expect(finishedQuerySpans()).toHaveLength(1);
    const [span] = finishedQuerySpans();
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes).toMatchObject({ "error.type": "22P02", "db.response.status_code": "22P02" });
    expect(JSON.stringify({ status: span.status, attributes: span.attributes, events: span.events })).not.toContain("user-secret-token");
  });

  it("records nothing for a query made outside any span, such as a health check or a queue poll", async () => {
    const { db, finishedQuerySpans } = setup();

    await db.execute(sql`select 1`);

    expect(finishedQuerySpans()).toEqual([]);
  });

  async function inRequestSpan<T>(run: () => Promise<T>) {
    return await context.with(trace.setSpan(context.active(), trace.getTracer("test").startSpan("GET /v1/user")), async () => await run());
  }

  function setup() {
    const db = container.resolve(POSTGRES_DB);
    const { finishedSpans, unregister } = recordFinishedSpans();
    onTestFinished(unregister);

    return {
      db,
      finishedQuerySpans: () => finishedSpans().filter(span => span.instrumentationScope.name === "@akashnetwork/instrumentation-postgres-js")
    };
  }
});
