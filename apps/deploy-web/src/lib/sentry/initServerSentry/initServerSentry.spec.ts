import type * as Sentry from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SentryHttpModule } from "../createTimeoutHttpModule/createTimeoutHttpModule";
import { isSentryEnvelopeUpload } from "../isSentryEnvelopeUpload/isSentryEnvelopeUpload";
import { initServerSentry } from "./initServerSentry";

const SERVER_DSN = "https://serverKey@o877251.ingest.sentry.io/4504";
const BROWSER_DSN = "https://browserKey@o877251.ingest.sentry.io/4504";

describe(initServerSentry.name, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("traces the node server without tracing Sentry's own envelope uploads", () => {
    const { sentry, fetchIntegration, httpModule } = setup({ runtime: "nodejs" });

    expect(sentry.nativeNodeFetchIntegration).toHaveBeenCalledWith({ ignoreOutgoingRequests: isSentryEnvelopeUpload });
    expect(sentry.init).toHaveBeenCalledWith({
      dsn: SERVER_DSN,
      enabled: true,
      beforeSend: expect.any(Function),
      beforeSendTransaction: expect.any(Function),
      tracesSampleRate: 0.1,
      transportOptions: { httpModule },
      integrations: [fetchIntegration]
    });
  });

  it("reports only errors from the edge runtime", () => {
    const { sentry } = setup({ runtime: "edge" });

    expect(sentry.init).toHaveBeenCalledWith({
      dsn: SERVER_DSN,
      enabled: true,
      beforeSend: expect.any(Function),
      beforeSendTransaction: expect.any(Function)
    });
    expect(sentry.nativeNodeFetchIntegration).not.toHaveBeenCalled();
  });

  it("falls back to the browser dsn and stays disabled unless enabled is true", () => {
    const { sentry } = setup({ runtime: "edge", serverDsn: "", enabled: "false" });

    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: BROWSER_DSN, enabled: false }));
  });

  it.each(["nodejs", "edge"])("drops the request body, cookies and credential headers from %s events before they are sent", runtime => {
    const { initOptions } = setup({ runtime });
    const event = {
      event_id: "event-1",
      request: {
        url: "https://console.test/api/auth/password-login",
        method: "POST",
        data: { email: "user@example.test", password: "user-password" },
        cookies: { appSession: "session-cookie" },
        headers: { "content-type": "application/json", cookie: "appSession=session-cookie", authorization: "Bearer access-token" }
      }
    };
    const expected = {
      event_id: "event-1",
      request: { url: "https://console.test/api/auth/password-login", method: "POST", headers: { "content-type": "application/json" } }
    };

    expect(initOptions.beforeSend?.({ ...event, type: undefined }, {})).toEqual({ ...expected, type: undefined });
    expect(initOptions.beforeSendTransaction?.({ ...event, type: "transaction" }, {})).toEqual({ ...expected, type: "transaction" });
  });

  it("keeps the request without headers when the event has none", () => {
    const { initOptions } = setup({ runtime: "nodejs" });

    expect(initOptions.beforeSend?.({ type: undefined, request: { url: "https://console.test/api/proxy" } }, {})).toEqual({
      type: undefined,
      request: { url: "https://console.test/api/proxy", headers: {} }
    });
  });

  it("sends an event without a request as it is", () => {
    const { initOptions } = setup({ runtime: "nodejs" });
    const event = { type: undefined, message: "boom" } as const;

    expect(initOptions.beforeSend?.(event, {})).toBe(event);
  });

  function setup(input: { runtime: string; serverDsn?: string; enabled?: string }) {
    vi.stubEnv("SENTRY_DSN", input.serverDsn ?? SERVER_DSN);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", BROWSER_DSN);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", input.enabled ?? "true");
    const fetchIntegration = mock<ReturnType<typeof Sentry.nativeNodeFetchIntegration>>();
    const sentry = mock<typeof Sentry>();
    sentry.nativeNodeFetchIntegration.mockReturnValue(fetchIntegration);
    const httpModule = mock<SentryHttpModule>();

    initServerSentry({ runtime: input.runtime, httpModule }, sentry);
    const [initOptions] = sentry.init.mock.calls[0] as [Sentry.NodeOptions];

    return { sentry, fetchIntegration, httpModule, initOptions };
  }
});
