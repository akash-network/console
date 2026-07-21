import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildContentSecurityPolicy,
  type ContentSecurityPolicyInput,
  getContentSecurityPolicyHeaderName,
  getContentSecurityPolicyReportHeaders,
  toOrigin,
  toSentrySecurityReportUri
} from "./csp";

describe("csp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("toOrigin", () => {
    it("reduces a URL with a path to a bare origin", () => {
      expect(toOrigin("https://features-edge.akash.network/api/frontend")).toBe("https://features-edge.akash.network");
      expect(toOrigin("https://2d6f725d@o877251.ingest.sentry.io/4504")).toBe("https://o877251.ingest.sentry.io");
    });

    it("returns undefined for relative, empty, or invalid values", () => {
      expect(toOrigin("/api-mainnet")).toBeUndefined();
      expect(toOrigin("")).toBeUndefined();
      expect(toOrigin(undefined)).toBeUndefined();
      expect(toOrigin("not a url")).toBeUndefined();
    });
  });

  describe("toSentrySecurityReportUri", () => {
    it("builds a Sentry security report URI from the browser DSN", () => {
      expect(toSentrySecurityReportUri("https://publicKey@o877251.ingest.sentry.io/4504")).toBe(
        "https://o877251.ingest.sentry.io/api/4504/security/?sentry_key=publicKey"
      );
    });

    it("preserves a self-hosted Sentry base path", () => {
      expect(toSentrySecurityReportUri("https://publicKey@sentry.example.com/sentry/4504")).toBe(
        "https://sentry.example.com/sentry/api/4504/security/?sentry_key=publicKey"
      );
    });

    it("returns undefined for relative, empty, or invalid values", () => {
      expect(toSentrySecurityReportUri("/sentry-dsn")).toBeUndefined();
      expect(toSentrySecurityReportUri("")).toBeUndefined();
      expect(toSentrySecurityReportUri(undefined)).toBeUndefined();
      expect(toSentrySecurityReportUri("not a url")).toBeUndefined();
    });
  });

  describe("buildContentSecurityPolicy", () => {
    it("includes origins derived from the provided env values", () => {
      const { connectSrc } = setup({
        mainnetApiUrl: "https://console-api.akash.network",
        unleashFrontendApiUrl: "https://features-edge.akash.network/api/frontend",
        sentryDsn: "https://key@o877251.ingest.sentry.io/4504"
      });

      expect(connectSrc).toContain("https://console-api.akash.network");
      expect(connectSrc).toContain("https://features-edge.akash.network");
      expect(connectSrc).toContain("https://o877251.ingest.sentry.io");
    });

    it("excludes origins that were not provided", () => {
      const { connectSrc } = setup({ mainnetApiUrl: "https://console-api.akash.network" });

      expect(connectSrc).not.toContain("https://console-api-sandbox.akash.network");
      expect(connectSrc).not.toContain("https://features-edge.akash.network");
    });

    it("does not leak relative api urls into connect-src", () => {
      const { connectSrc } = setup({ mainnetApiUrl: "/api-mainnet", sandboxApiUrl: "/api-sandbox" });

      expect(connectSrc).not.toContain("/api-mainnet");
      expect(connectSrc).not.toContain("/api-sandbox");
      expect(connectSrc).toContain("'self'");
    });

    it("always includes fixed vendor connect origins", () => {
      const { connectSrc } = setup({});

      expect(connectSrc).toContain("https://www.google-analytics.com");
      expect(connectSrc).toContain("https://www.googletagmanager.com");
    });

    it("adds Sentry CSP reporting directives when a Sentry DSN is configured", () => {
      const { reportUri, reportTo } = setup({ sentryDsn: "https://publicKey@o877251.ingest.sentry.io/4504" });

      expect(reportUri).toBe("report-uri https://o877251.ingest.sentry.io/api/4504/security/?sentry_key=publicKey");
      expect(reportTo).toBe("report-to csp-endpoint");
    });

    it("omits Sentry CSP reporting directives when no Sentry DSN is configured", () => {
      const { reportUri, reportTo } = setup({});

      expect(reportUri).toBeUndefined();
      expect(reportTo).toBeUndefined();
    });
  });

  describe("getContentSecurityPolicyHeaderName", () => {
    it("returns the enforce header when CSP_MODE is enforce", () => {
      vi.stubEnv("CSP_MODE", "enforce");
      expect(getContentSecurityPolicyHeaderName()).toBe("Content-Security-Policy");
    });

    it("returns the report-only header by default", () => {
      vi.stubEnv("CSP_MODE", "");
      expect(getContentSecurityPolicyHeaderName()).toBe("Content-Security-Policy-Report-Only");
    });
  });

  describe("getContentSecurityPolicyReportHeaders", () => {
    it("returns Report-To and Reporting-Endpoints headers for the Sentry CSP endpoint", () => {
      const headers = getContentSecurityPolicyReportHeaders({ sentryDsn: "https://publicKey@o877251.ingest.sentry.io/4504" });

      expect(headers).toEqual([
        {
          name: "Report-To",
          value: JSON.stringify({
            group: "csp-endpoint",
            max_age: 10886400,
            endpoints: [{ url: "https://o877251.ingest.sentry.io/api/4504/security/?sentry_key=publicKey" }],
            include_subdomains: true
          })
        },
        {
          name: "Reporting-Endpoints",
          value: 'csp-endpoint="https://o877251.ingest.sentry.io/api/4504/security/?sentry_key=publicKey"'
        }
      ]);
    });

    it("returns no reporting headers when no Sentry DSN is configured", () => {
      expect(getContentSecurityPolicyReportHeaders({})).toEqual([]);
    });
  });

  function setup(input: ContentSecurityPolicyInput) {
    const policy = buildContentSecurityPolicy("test-nonce", input);
    const directives = Object.fromEntries(policy.split("; ").map(directive => [directive.split(" ")[0], directive]));
    return { policy, connectSrc: directives["connect-src"], reportUri: directives["report-uri"], reportTo: directives["report-to"] };
  }
});
