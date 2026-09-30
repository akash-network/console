import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VIOLATION_REPORT_SAMPLE_RATE } from "./lib/csp/csp";
import { middleware } from "./middleware";

describe("middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("asks the browser to report CSP violations from a page load inside the report sample", () => {
    const { response } = setup({ path: "/", sentryDsn: "https://publicKey@o877251.ingest.sentry.io/4504", violationReportDraw: 0 });

    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain(
      "report-uri https://o877251.ingest.sentry.io/api/4504/security/?sentry_key=publicKey"
    );
    expect(response.headers.get("Reporting-Endpoints")).toBe('csp-endpoint="https://o877251.ingest.sentry.io/api/4504/security/?sentry_key=publicKey"');
  });

  it("keeps CSP violation reporting off for a page load outside the report sample", () => {
    const { response } = setup({
      path: "/",
      sentryDsn: "https://publicKey@o877251.ingest.sentry.io/4504",
      violationReportDraw: VIOLATION_REPORT_SAMPLE_RATE
    });

    expect(response.headers.get("Content-Security-Policy-Report-Only")).not.toContain("report-uri");
    expect(response.headers.get("Reporting-Endpoints")).toBeNull();
  });

  it("redirects to the requested relative path when leaving the maintenance page", () => {
    const { response } = setup({ path: "/maintenance?return=%2Fgraph%2Fdaily-akt-spent" });

    expect(response.headers.get("location")).toBe("http://localhost/graph/daily-akt-spent");
  });

  it("ignores an absolute return url when leaving the maintenance page", () => {
    const { response } = setup({ path: "/maintenance?return=https%3A%2F%2Fevil.example%2Fphish" });

    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("ignores a protocol relative return url when leaving the maintenance page", () => {
    const { response } = setup({ path: "/maintenance?return=%2F%2Fevil.example%2Fphish" });

    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("ignores a backslash prefixed return url when leaving the maintenance page", () => {
    const { response } = setup({ path: "/maintenance?return=%2F%5Cevil.example%2Fphish" });

    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  function setup(input: { path: string; sentryDsn?: string; violationReportDraw?: number }) {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", input.sentryDsn ?? "");
    vi.spyOn(Math, "random").mockReturnValue(input.violationReportDraw ?? 1);
    const request = new NextRequest(new URL(`http://localhost${input.path}`));
    const response = middleware(request);
    return { request, response };
  }
});
