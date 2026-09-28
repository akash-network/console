import type { Span, Tracer } from "@opentelemetry/api";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { Trace, withSpan } from "./tracing.util";

const UPDATE_API_KEY = 'update "api_keys" set "hashed_key" = $1 where "id" = $2';
const REDACTED_MESSAGE = `Failed query: ${UPDATE_API_KEY}\nparams: <redacted string>, 7`;

describe("tracing", () => {
  describe(withSpan.name, () => {
    it("records a failed query on the span with its params redacted", async () => {
      const { span } = setup();
      const error = failedQuery();

      await expect(withSpan("rotate-api-key", () => Promise.reject(error))).rejects.toBe(error);

      expectRecordedFailure(span, REDACTED_MESSAGE);
    });

    it("records any other error on the span as it is", async () => {
      const { span } = setup();
      const error = new Error("provider unreachable");

      await expect(withSpan("send-manifest", () => Promise.reject(error))).rejects.toBe(error);

      expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR, message: "provider unreachable" });
      expect(span.recordException).toHaveBeenCalledWith(error);
    });
  });

  describe(Trace.name, () => {
    it("records a failed query of an async method on the span with its params redacted", async () => {
      const { span } = setup();
      const error = failedQuery();
      const rotate = traced(async () => {
        throw error;
      });

      await expect(rotate()).rejects.toBe(error);

      expectRecordedFailure(span, REDACTED_MESSAGE);
    });

    it("records a failed query of a sync method on the span with its params redacted", () => {
      const { span } = setup();
      const error = failedQuery();
      const rotate = traced(() => {
        throw error;
      });

      expect(rotate).toThrow(error);

      expectRecordedFailure(span, REDACTED_MESSAGE);
    });
  });

  function failedQuery() {
    return new DrizzleQueryError(UPDATE_API_KEY, ["hashed-api-key", 7], new Error("connection terminated"));
  }

  function traced(method: () => unknown) {
    const descriptor = Trace("api-key.rotate")({ constructor: { name: "ApiKeyService" } }, "rotate", { value: method });
    return descriptor.value as () => unknown;
  }

  function expectRecordedFailure(span: Span, message: string) {
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR, message });
    expect(span.recordException).toHaveBeenCalledWith(expect.objectContaining({ message, stack: expect.not.stringContaining("hashed-api-key") }));
  }

  function setup() {
    const span = mock<Span>();
    vi.spyOn(trace, "getTracer").mockReturnValue(mock<Tracer>({ startSpan: vi.fn().mockReturnValue(span) }));
    return { span };
  }
});
