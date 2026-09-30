import type * as Sentry from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { isSentryEnvelopeUpload } from "../isSentryEnvelopeUpload/isSentryEnvelopeUpload";
import { initServerSentry } from "./initServerSentry";

const SERVER_DSN = "https://serverKey@o877251.ingest.sentry.io/4504";
const BROWSER_DSN = "https://browserKey@o877251.ingest.sentry.io/4504";

describe(initServerSentry.name, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("traces the node server without tracing Sentry's own envelope uploads", () => {
    const { sentry, fetchIntegration } = setup({ runtime: "nodejs" });

    expect(sentry.nativeNodeFetchIntegration).toHaveBeenCalledWith({ ignoreOutgoingRequests: isSentryEnvelopeUpload });
    expect(sentry.init).toHaveBeenCalledWith({ dsn: SERVER_DSN, enabled: true, tracesSampleRate: 0.1, integrations: [fetchIntegration] });
  });

  it("reports only errors from the edge runtime", () => {
    const { sentry } = setup({ runtime: "edge" });

    expect(sentry.init).toHaveBeenCalledWith({ dsn: SERVER_DSN, enabled: true });
    expect(sentry.nativeNodeFetchIntegration).not.toHaveBeenCalled();
  });

  it("falls back to the browser dsn and stays disabled unless enabled is true", () => {
    const { sentry } = setup({ runtime: "edge", serverDsn: "", enabled: "false" });

    expect(sentry.init).toHaveBeenCalledWith({ dsn: BROWSER_DSN, enabled: false });
  });

  function setup(input: { runtime: string; serverDsn?: string; enabled?: string }) {
    vi.stubEnv("SENTRY_DSN", input.serverDsn ?? SERVER_DSN);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", BROWSER_DSN);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENABLED", input.enabled ?? "true");
    const fetchIntegration = mock<ReturnType<typeof Sentry.nativeNodeFetchIntegration>>();
    const sentry = mock<typeof Sentry>();
    sentry.nativeNodeFetchIntegration.mockReturnValue(fetchIntegration);

    initServerSentry(input.runtime, sentry);

    return { sentry, fetchIntegration };
  }
});
