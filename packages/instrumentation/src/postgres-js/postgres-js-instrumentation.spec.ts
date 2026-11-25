import type { Tracer, TracerProvider } from "@opentelemetry/api";
import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import diagnosticsChannel from "node:diagnostics_channel";
import { describe, expect, it, onTestFinished } from "vitest";
import { mock } from "vitest-mock-extended";

import { recordFinishedSpans } from "../testing/register-context-propagation";
import type { PostgresJsQueryTrace } from "./postgres-js-instrumentation";
import { PostgresJsInstrumentation } from "./postgres-js-instrumentation";

const queryChannel = diagnosticsChannel.tracingChannel<unknown, PostgresJsQueryTrace>("postgres:query");
const SELECT_USER = 'select "id" from "users" where "id" = $1';

describe(PostgresJsInstrumentation.name, () => {
  it("records one client span per query with the PostgreSQL semantic convention attributes", async () => {
    const { finishedSpans } = setup();

    await runQuery({ database: "console", query: SELECT_USER, command: "SELECT", count: 1, host: "db.internal", port: 5432 });

    expect(finishedSpans()).toHaveLength(1);
    const [span] = finishedSpans();
    expect(span.name).toBe("SELECT console");
    expect(span.kind).toBe(SpanKind.CLIENT);
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.attributes).toEqual({
      "db.system.name": "postgresql",
      "db.namespace": "console",
      "db.query.text": SELECT_USER,
      "db.operation.name": "SELECT",
      "db.response.returned_rows": 1,
      "server.address": "db.internal",
      "server.port": 5432
    });
  });

  it("parents the span to the span active where the query was made", async () => {
    const { finishedSpans } = setup();
    const parent = trace.getTracer("test").startSpan("GET /v1/user");

    await context.with(trace.setSpan(context.active(), parent), () => publishQuery({ database: "console", command: "SELECT" }));

    expect(finishedSpans()[0].parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
    expect(finishedSpans()[0].spanContext().traceId).toBe(parent.spanContext().traceId);
  });

  it("records nothing for a query made outside any span", async () => {
    const { finishedSpans } = setup();

    await publishQuery({ database: "console", query: SELECT_USER, command: "SELECT" });

    expect(finishedSpans()).toEqual([]);
  });

  it("skips the BEGIN and SAVEPOINT that open a transaction but keeps its COMMIT", async () => {
    const { finishedSpans } = setup();

    await runQuery({ database: "console", query: "begin ", command: "BEGIN" });
    await runQuery({ database: "console", query: 'savepoint "s0"', command: "SAVEPOINT" });
    await runQuery({ database: "console", query: "commit", command: "COMMIT" });

    expect(finishedSpans().map(span => span.name)).toEqual(["COMMIT console"]);
  });

  it("cuts the query text at 2048 characters", async () => {
    const { finishedSpans } = setup();
    const longQuery = `select ${'"column", '.repeat(400)}1`;

    await runQuery({ database: "console", query: longQuery, command: "SELECT" });

    expect(finishedSpans()[0].attributes["db.query.text"]).toBe(longQuery.slice(0, 2048));
  });

  it("names the span after the database alone when the query never completed a command", async () => {
    const { finishedSpans } = setup();

    await runQuery({ database: "console" });

    expect(finishedSpans()[0].name).toBe("console");
    expect(finishedSpans()[0].attributes).toEqual({ "db.system.name": "postgresql", "db.namespace": "console" });
  });

  it("names the span after the database system when the client has no database", async () => {
    const { finishedSpans } = setup();

    await runQuery({ command: "SELECT" });

    expect(finishedSpans()[0].name).toBe("SELECT postgresql");
  });

  it("marks the span failed with the SQLSTATE of an error the server returned, leaving out the value it quotes", async () => {
    const { finishedSpans } = setup();
    const error = Object.assign(new Error('invalid input syntax for type uuid: "user-secret-token"'), { code: "22P02", severity: "ERROR" });

    await expect(runQuery({ database: "console", query: SELECT_USER }, error)).rejects.toBe(error);

    const [span] = finishedSpans();
    expect(span.status).toEqual({ code: SpanStatusCode.ERROR, message: "22P02" });
    expect(span.attributes).toMatchObject({ "error.type": "22P02", "db.response.status_code": "22P02" });
    expect(JSON.stringify({ attributes: span.attributes, events: span.events })).not.toContain("user-secret-token");
  });

  it("marks the span failed with the client error code and no response status when the server never answered", async () => {
    const { finishedSpans } = setup();
    const error = Object.assign(new Error("write CONNECTION_CLOSED db.internal:5432"), { code: "CONNECTION_CLOSED" });

    await expect(runQuery({ database: "console" }, error)).rejects.toBe(error);

    expect(finishedSpans()[0].attributes["error.type"]).toBe("CONNECTION_CLOSED");
    expect(finishedSpans()[0].attributes).not.toHaveProperty("db.response.status_code");
  });

  it("falls back to the error name when the error has no code", async () => {
    const { finishedSpans } = setup();

    await expect(runQuery({ database: "console" }, new TypeError("bad input"))).rejects.toThrow("bad input");

    expect(finishedSpans()[0].attributes["error.type"]).toBe("TypeError");
  });

  it("never records the bound values postgres.js publishes in debug mode", async () => {
    const { finishedSpans } = setup();

    await runQuery({ database: "console", query: SELECT_USER, command: "SELECT", parameters: ["user-secret-token"] });

    expect(JSON.stringify(finishedSpans()[0].attributes)).not.toContain("user-secret-token");
  });

  it("ignores a query that was already running when it subscribed", async () => {
    const { finishedSpans, instrumentation } = setup({ enabled: false });
    const inFlightQuery = queryTrace({ database: "console" });
    inRequestSpan(() => queryChannel.start.publish(inFlightQuery));
    instrumentation.enable();

    inRequestSpan(() => {
      queryChannel.error.publish(Object.assign(inFlightQuery, { error: new Error("canceled") }));
      queryChannel.asyncEnd.publish(inFlightQuery);
    });

    expect(finishedSpans()).toEqual([]);
  });

  it("records nothing while disabled from the start", async () => {
    const { finishedSpans, instrumentation } = setup({ enabled: false });

    await runQuery({ database: "console" });

    expect(finishedSpans()).toEqual([]);
    expect(instrumentation.getConfig()).toEqual({ enabled: false });
  });

  it("stops recording once disabled", async () => {
    const { finishedSpans, instrumentation } = setup();
    instrumentation.disable();

    await runQuery({ database: "console" });

    expect(finishedSpans()).toEqual([]);
  });

  it("stops recording with a single disable however many times it was enabled", async () => {
    const { finishedSpans, instrumentation } = setup();
    instrumentation.enable();
    instrumentation.disable();

    await runQuery({ database: "console" });

    expect(finishedSpans()).toEqual([]);
  });

  it("records again once enabled after being disabled", async () => {
    const { finishedSpans, instrumentation } = setup();
    instrumentation.disable();
    instrumentation.enable();

    await runQuery({ database: "console" });

    expect(finishedSpans()).toHaveLength(1);
  });

  it("starts spans from the tracer provider the SDK hands it", async () => {
    const { instrumentation } = setup();
    const tracer = mock<Tracer>();
    const tracerProvider = mock<TracerProvider>();
    tracerProvider.getTracer.mockReturnValue(tracer);
    instrumentation.setTracerProvider(tracerProvider);

    await runQuery({ database: "console" });

    expect(tracerProvider.getTracer).toHaveBeenCalledWith(instrumentation.instrumentationName, instrumentation.instrumentationVersion);
    expect(tracer.startSpan).toHaveBeenCalledWith("console", expect.objectContaining({ kind: SpanKind.CLIENT }));
  });

  it("keeps its current config for the keys an update leaves out", () => {
    const { instrumentation } = setup();

    instrumentation.setConfig({});

    expect(instrumentation.getConfig()).toEqual({ enabled: true });
  });

  function queryTrace(input: Partial<PostgresJsQueryTrace> & { parameters?: unknown[] }) {
    return { query: null, host: null, port: null, command: null, count: null, ...input };
  }

  function runQuery(input: Partial<PostgresJsQueryTrace> & { parameters?: unknown[] }, error?: Error) {
    return inRequestSpan(() => publishQuery(input, error));
  }

  function inRequestSpan<T>(run: () => T) {
    return context.with(trace.setSpan(context.active(), trace.getTracer("test").startSpan("GET /v1/user")), run);
  }

  function publishQuery(input: Partial<PostgresJsQueryTrace> & { parameters?: unknown[] }, error?: Error) {
    const { command, count, host, port, ...startedQuery } = input;
    const queryContext = queryTrace(startedQuery);

    return queryChannel.tracePromise(async () => {
      Object.assign(queryContext, { command: command ?? null, count: count ?? null, host: host ?? null, port: port ?? null });
      if (error) throw error;
    }, queryContext);
  }

  function setup(input?: { enabled?: boolean }) {
    const { finishedSpans, unregister } = recordFinishedSpans();
    const instrumentation = new PostgresJsInstrumentation(input);
    onTestFinished(async () => {
      instrumentation.disable();
      await unregister();
    });

    return { finishedSpans, instrumentation };
  }
});
