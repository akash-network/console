import type { Span } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";
import { Hono } from "hono";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { redactSpanUrlCredentials } from "./redact-span-url.middleware";

describe("redactSpanUrlCredentials", () => {
  it("records the request url on the active span with the values of credential parameters replaced", async () => {
    const { span, request } = setup();

    const response = await request("/v1/product-update-unsubscriptions?token=user-1.signature");

    expect(span.setAttribute).toHaveBeenCalledWith("url.full", "http://localhost/v1/product-update-unsubscriptions?token=REDACTED");
    expect(response.status).toBe(200);
  });

  it("lets the request through when no span is active", async () => {
    const { request } = setup({ activeSpan: false });

    const response = await request("/v1/product-update-unsubscriptions?token=user-1.signature");

    expect(response.status).toBe(200);
  });

  function setup(input: { activeSpan?: boolean } = {}) {
    const span = mock<Span>();
    const getActiveSpan = vi.spyOn(trace, "getActiveSpan").mockReturnValue(input.activeSpan === false ? undefined : span);
    onTestFinished(() => getActiveSpan.mockRestore());

    const app = new Hono();
    app.use(redactSpanUrlCredentials);
    app.all("*", c => c.text("reached the handler"));

    return { span, request: (path: string) => app.request(path) };
  }
});
