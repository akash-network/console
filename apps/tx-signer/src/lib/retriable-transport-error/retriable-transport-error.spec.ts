import { describe, expect, it } from "vitest";

import { isRetriableTransportError } from "./retriable-transport-error";

describe(isRetriableTransportError.name, () => {
  it("treats a 5xx-shaped rpc error as retriable", () => {
    expect(isRetriableTransportError(new Error("Bad status on response: 503"))).toBe(true);
  });

  it("treats a 4xx-shaped rpc error as not retriable", () => {
    expect(isRetriableTransportError(new Error("Bad status on response: 404"))).toBe(false);
  });

  it("treats a top-level network code as retriable", () => {
    expect(isRetriableTransportError(Object.assign(new Error("socket reset"), { code: "ECONNRESET" }))).toBe(true);
  });

  it("treats a network code on the cause as retriable", () => {
    const error = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("socket reset"), { code: "ECONNRESET" })
    });

    expect(isRetriableTransportError(error)).toBe(true);
  });

  it("treats a per-request timeout abort as retriable", () => {
    expect(isRetriableTransportError(new DOMException("The operation was aborted due to timeout", "TimeoutError"))).toBe(true);
  });

  it("treats a caller-initiated abort as retriable", () => {
    expect(isRetriableTransportError(new DOMException("The operation was aborted", "AbortError"))).toBe(true);
  });

  it("treats a timeout abort on the cause as retriable", () => {
    const error = Object.assign(new TypeError("fetch failed"), {
      cause: new DOMException("The operation was aborted due to timeout", "TimeoutError")
    });

    expect(isRetriableTransportError(error)).toBe(true);
  });

  it("treats an application error as not retriable", () => {
    expect(isRetriableTransportError(new Error("totally unrelated failure"))).toBe(false);
  });

  it("treats a non-error rejection as not retriable", () => {
    expect(isRetriableTransportError("boom")).toBe(false);
  });
});
