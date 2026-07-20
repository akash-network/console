import { afterEach, describe, expect, it, vi } from "vitest";

import { buildContentSecurityPolicy, type ContentSecurityPolicyInput, getContentSecurityPolicyHeaderName, toOrigin } from "./csp";

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

  describe("buildContentSecurityPolicy", () => {
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

    it("derives the templates img-src origin from the provided value", () => {
      const { imgSrc } = setup({ templatesUrl: "https://akash-templates.pages.dev" });

      expect(imgSrc).toContain("https://akash-templates.pages.dev");
    });

    it("always allows Amplitude endpoints since Session Replay is not routed through the proxy", () => {
      const { connectSrc } = setup({});

      expect(connectSrc).toContain("https://*.amplitude.com");
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

  function setup(input: ContentSecurityPolicyInput) {
    const policy = buildContentSecurityPolicy("test-nonce", input);
    const directives = Object.fromEntries(policy.split("; ").map(directive => [directive.split(" ")[0], directive]));
    return { policy, connectSrc: directives["connect-src"], imgSrc: directives["img-src"] };
  }
});
