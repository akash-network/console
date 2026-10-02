import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildContentSecurityPolicy,
  type ContentSecurityPolicyInput,
  generateScriptNonce,
  getContentSecurityPolicyHeaderName,
  getContentSecurityPolicyReportHeaders,
  isSampledForViolationReports,
  THEME_SCRIPT_HASH,
  toOrigin,
  toSentrySecurityReportUri,
  VIOLATION_REPORT_SAMPLE_RATE
} from "./csp";

describe("csp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("toOrigin", () => {
    it("reduces a URL with a path to a bare origin", () => {
      expect(toOrigin("https://features-edge.akash.network/api/frontend")).toBe("https://features-edge.akash.network");
      expect(toOrigin("https://console-proxy.akash.network/collect")).toBe("https://console-proxy.akash.network");
    });

    it("returns undefined for relative, empty, or invalid values", () => {
      expect(toOrigin("/provider-proxy-mainnet")).toBeUndefined();
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
    it("allows first-party, vendor, and hashed theme scripts without strict-dynamic or unsafe-inline", () => {
      const { scriptSrc } = setup({});

      expect(scriptSrc).toContain("'self'");
      expect(scriptSrc).toContain(THEME_SCRIPT_HASH);
      expect(scriptSrc).toContain("https://www.googletagmanager.com");
      expect(scriptSrc).toContain("https://*.google-analytics.com");
      expect(scriptSrc).toContain("https://pxl.growth-channel.net");
      expect(scriptSrc).toContain("https://challenges.cloudflare.com");
      expect(scriptSrc).toContain("https://js.stripe.com");
      expect(scriptSrc).not.toContain("'strict-dynamic'");
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it("allows the script nonce Cloudflare stamps onto its injected bot detection script", () => {
      const { scriptSrc } = setup({ scriptNonce: "cmVxdWVzdC1ub25jZQ==" });

      expect(scriptSrc).toContain("'nonce-cmVxdWVzdC1ub25jZQ=='");
      expect(scriptSrc).toContain("'self'");
      expect(scriptSrc).not.toContain("'strict-dynamic'");
    });

    it("leaves only the nonce source out when no script nonce is given", () => {
      const withoutNonce = setup({}).scriptSrc;
      const withNonce = setup({ scriptNonce: "cmVxdWVzdC1ub25jZQ==" }).scriptSrc;

      expect(withoutNonce).toEqual(withNonce.filter(source => source !== "'nonce-cmVxdWVzdC1ub25jZQ=='"));
    });

    it("asks for a sample of every blocked inline script so its origin shows in the report", () => {
      const { scriptSrc } = setup({});

      expect(scriptSrc).toContain("'report-sample'");
    });

    it("includes origins derived from the provided env values", () => {
      const { connectSrc } = setup({
        amplitudeProxyUrl: "https://console-proxy.akash.network/collect",
        unleashFrontendApiUrl: "https://features-edge.akash.network/api/frontend",
        sentryDsn: "https://key@o877251.ingest.sentry.io/4504",
        networkRpcAndApiUrls: ["https://rpc.akt.dev/rpc", "https://api.akashnet.net:443"]
      });

      expect(connectSrc).toContain("https://console-proxy.akash.network");
      expect(connectSrc).toContain("https://features-edge.akash.network");
      expect(connectSrc).toContain("https://o877251.ingest.sentry.io");
      expect(connectSrc).toContain("https://rpc.akt.dev");
      expect(connectSrc).toContain("https://api.akashnet.net");
    });

    it("adds a websocket origin for the provider proxy", () => {
      const { connectSrc } = setup({ providerProxyUrl: "https://console-proxy.akash.network" });

      expect(connectSrc).toContain("https://console-proxy.akash.network");
      expect(connectSrc).toContain("wss://console-proxy.akash.network");
    });

    it("excludes origins that were not provided", () => {
      const { connectSrc } = setup({ amplitudeProxyUrl: "https://console-proxy.akash.network/collect" });

      expect(connectSrc).not.toContain("https://features-edge.akash.network");
    });

    it("does not leak relative api or proxy urls into connect-src", () => {
      const { connectSrc } = setup({
        mainnetApiUrl: "/api-mainnet",
        sandboxApiUrl: "/api-sandbox",
        providerProxyUrl: "/provider-proxy-mainnet"
      });

      expect(connectSrc).not.toContain("/api-mainnet");
      expect(connectSrc).not.toContain("/provider-proxy-mainnet");
      expect(connectSrc).toContain("'self'");
    });

    it("derives the templates connect-src origin from the provided value", () => {
      const { connectSrc } = setup({ templatesUrl: "https://akash-templates.pages.dev" });

      expect(connectSrc).toContain("https://akash-templates.pages.dev");
    });

    it("allows any https image source because template logos point at arbitrary origins", () => {
      const { imgSrc } = setup({});

      expect(imgSrc).toContain("'self'");
      expect(imgSrc).toContain("https:");
      expect(imgSrc).toContain("data:");
      expect(imgSrc).toContain("blob:");
    });

    it("allows the bare analytics.google.com host the subdomain wildcard cannot match", () => {
      const { connectSrc } = setup({});

      expect(connectSrc).toContain("https://analytics.google.com");
      expect(connectSrc).toContain("https://*.analytics.google.com");
      expect(connectSrc).toContain("https://*.google-analytics.com");
    });

    it("allows the jsDelivr origin the provider map fetches its topology from", () => {
      const { connectSrc } = setup({});

      expect(connectSrc).toContain("https://cdn.jsdelivr.net");
    });

    it("allows the marketing tags the GTM container fires", () => {
      const { scriptSrc, styleSrc, connectSrc } = setup({});

      expect(scriptSrc).toContain("https://tags.srv.stackadapt.com");
      expect(scriptSrc).toContain("https://pxl.iqm.com");
      expect(scriptSrc).toContain("https://wt.rqtrk.eu");
      expect(styleSrc).toContain("https://tags.srv.stackadapt.com");
      expect(connectSrc).toContain("https://tags.srv.stackadapt.com");
      expect(connectSrc).toContain("https://*.g.doubleclick.net");
    });

    it("names Google Ads country endpoints individually because CSP cannot wildcard a TLD", () => {
      const { connectSrc } = setup({});

      expect(connectSrc).toEqual(
        expect.arrayContaining([
          "https://www.google.com",
          "https://www.google.be",
          "https://www.google.co.in",
          "https://www.google.com.br",
          "https://www.google.com.pe",
          "https://www.google.com.ph",
          "https://www.google.com.pk",
          "https://www.google.com.ua",
          "https://www.google.com.vn",
          "https://www.google.de",
          "https://www.google.fi",
          "https://www.google.fr",
          "https://www.google.kz",
          "https://www.google.pl",
          "https://www.google.pt"
        ])
      );
    });

    it("always allows Amplitude endpoints since Session Replay is not routed through the proxy", () => {
      const { connectSrc } = setup({});

      expect(connectSrc).toContain("https://*.amplitude.com");
    });

    it("adds Sentry CSP reporting directives to a page load that reports violations", () => {
      const { reportUri, reportTo } = setup({ sentryDsn: "https://publicKey@o877251.ingest.sentry.io/4504", reportViolations: true });

      expect(reportUri).toEqual(["https://o877251.ingest.sentry.io/api/4504/security/?sentry_key=publicKey"]);
      expect(reportTo).toEqual(["csp-endpoint"]);
    });

    it("omits Sentry CSP reporting directives from a page load that does not report violations", () => {
      const { reportUri, reportTo } = setup({ sentryDsn: "https://publicKey@o877251.ingest.sentry.io/4504", reportViolations: false });

      expect(reportUri).toBeUndefined();
      expect(reportTo).toBeUndefined();
    });

    it("omits Sentry CSP reporting directives when no Sentry DSN is configured", () => {
      const { reportUri, reportTo } = setup({ reportViolations: true });

      expect(reportUri).toBeUndefined();
      expect(reportTo).toBeUndefined();
    });
  });

  describe(generateScriptNonce.name, () => {
    it("encodes 128 random bits as base64", () => {
      const nonce = generateScriptNonce();

      expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
      expect(atob(nonce)).toHaveLength(16);
    });

    it("draws a different nonce on every call", () => {
      expect(generateScriptNonce()).not.toBe(generateScriptNonce());
    });
  });

  describe(isSampledForViolationReports.name, () => {
    it("samples a page load whose draw falls below the sample rate", () => {
      expect(isSampledForViolationReports(() => VIOLATION_REPORT_SAMPLE_RATE / 2)).toBe(true);
    });

    it("does not sample a page load whose draw equals the sample rate", () => {
      expect(isSampledForViolationReports(() => VIOLATION_REPORT_SAMPLE_RATE)).toBe(false);
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
      const headers = getContentSecurityPolicyReportHeaders({ sentryDsn: "https://publicKey@o877251.ingest.sentry.io/4504", reportViolations: true });

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

    it("returns no reporting headers for a page load that does not report violations", () => {
      expect(getContentSecurityPolicyReportHeaders({ sentryDsn: "https://publicKey@o877251.ingest.sentry.io/4504", reportViolations: false })).toEqual([]);
    });

    it("returns no reporting headers when no Sentry DSN is configured", () => {
      expect(getContentSecurityPolicyReportHeaders({ reportViolations: true })).toEqual([]);
    });
  });

  function setup(input: ContentSecurityPolicyInput) {
    const policy = buildContentSecurityPolicy(input);
    const directives = Object.fromEntries(
      policy.split("; ").map(directive => {
        const [name, ...sources] = directive.split(" ");
        return [name, sources];
      })
    );
    return {
      policy,
      scriptSrc: directives["script-src"],
      styleSrc: directives["style-src"],
      connectSrc: directives["connect-src"],
      imgSrc: directives["img-src"],
      reportUri: directives["report-uri"],
      reportTo: directives["report-to"]
    };
  }
});
