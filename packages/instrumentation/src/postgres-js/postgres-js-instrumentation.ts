import type { Span, TracerProvider } from "@opentelemetry/api";
import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Instrumentation, InstrumentationConfig } from "@opentelemetry/instrumentation";
import diagnosticsChannel from "node:diagnostics_channel";

/** What postgres.js v4 publishes on `postgres:query`; bound values only appear under `debug: true`, which these spans never read. */
export interface PostgresJsQueryTrace {
  query: string | null;
  database?: string;
  host: string | null;
  port: number | null;
  command: string | null;
  count: number | null;
}

/** postgres.js wraps anything a query rejects with in an Error; a server error also carries its SQLSTATE `code` and a `severity`. */
type PostgresJsQueryError = Error & { code?: string; severity?: string };

const INSTRUMENTATION_NAME = "@akashnetwork/instrumentation-postgres-js";
const INSTRUMENTATION_VERSION = "1.0.0";
const DB_SYSTEM = "postgresql";
const MAX_QUERY_TEXT_LENGTH = 2048;
const TRANSACTION_OPENING = /^\s*(begin|savepoint)\b/i;

export class PostgresJsInstrumentation implements Instrumentation {
  readonly instrumentationName = INSTRUMENTATION_NAME;
  readonly instrumentationVersion = INSTRUMENTATION_VERSION;

  readonly #queryChannel = diagnosticsChannel.tracingChannel<unknown, PostgresJsQueryTrace>("postgres:query");
  readonly #spans = new WeakMap<PostgresJsQueryTrace, Span>();
  readonly #subscribers = {
    start: (query: PostgresJsQueryTrace) => {
      if (isWorthASpan(query)) this.#spans.set(query, this.#startSpan(query));
    },
    end: () => {},
    asyncStart: () => {},
    asyncEnd: (query: PostgresJsQueryTrace) => this.#endSpan(query),
    error: (query: PostgresJsQueryTrace & { error: unknown }) => this.#recordError(query, query.error as PostgresJsQueryError)
  };
  #tracerProvider: TracerProvider = trace;
  #config: InstrumentationConfig;
  #subscribed = false;

  constructor(config: InstrumentationConfig = {}) {
    this.#config = { enabled: true, ...config };

    if (this.#config.enabled) {
      this.enable();
    }
  }

  enable(): void {
    if (this.#subscribed) return;

    this.#queryChannel.subscribe(this.#subscribers);
    this.#subscribed = true;
  }

  disable(): void {
    this.#queryChannel.unsubscribe(this.#subscribers);
    this.#subscribed = false;
  }

  setTracerProvider(tracerProvider: TracerProvider): void {
    this.#tracerProvider = tracerProvider;
  }

  setMeterProvider(): void {}

  setConfig(config: InstrumentationConfig): void {
    this.#config = { ...this.#config, ...config };
  }

  getConfig(): InstrumentationConfig {
    return this.#config;
  }

  #startSpan(query: PostgresJsQueryTrace): Span {
    return this.#tracerProvider.getTracer(INSTRUMENTATION_NAME, INSTRUMENTATION_VERSION).startSpan(query.database ?? DB_SYSTEM, {
      kind: SpanKind.CLIENT,
      attributes: {
        "db.system.name": DB_SYSTEM,
        "db.namespace": query.database
      }
    });
  }

  /** Keeps the driver's message off the span, since Postgres quotes the value it rejected there and the bound values to redact it with never reach this channel. */
  #recordError(query: PostgresJsQueryTrace, error: PostgresJsQueryError): void {
    const span = this.#spans.get(query);
    if (!span) return;

    const errorType = error.code ?? error.name;
    span.setStatus({ code: SpanStatusCode.ERROR, message: errorType });
    span.setAttribute("error.type", errorType);
    if (error.severity) {
      span.setAttributes({ "db.response.status_code": error.code });
    }
  }

  #endSpan(query: PostgresJsQueryTrace): void {
    const span = this.#spans.get(query);
    if (!span) return;

    span.setAttributes({
      "db.query.text": query.query?.slice(0, MAX_QUERY_TEXT_LENGTH),
      "db.operation.name": query.command ?? undefined,
      "db.response.returned_rows": query.count ?? undefined,
      "server.address": query.host ?? undefined,
      "server.port": query.port ?? undefined
    });
    if (query.command) {
      span.updateName(`${query.command} ${query.database ?? DB_SYSTEM}`);
    }
    span.end();
  }
}

/** A query outside any span would open a trace of its own, and a BEGIN or SAVEPOINT adds nothing the spans of its transaction don't already show. */
function isWorthASpan(query: PostgresJsQueryTrace): boolean {
  return trace.getActiveSpan() !== undefined && !TRANSACTION_OPENING.test(query.query ?? "");
}
