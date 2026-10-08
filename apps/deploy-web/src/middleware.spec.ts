import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_SCRIPT_HASH, VIOLATION_REPORT_SAMPLE_RATE } from "@src/lib/csp/csp";
import { REFERRAL_COOKIE_MAX_AGE_SECONDS, REFERRAL_COOKIE_NAME } from "@src/lib/referral/referral-cookie";
import { middleware } from "@src/middleware";

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

  it("sets a report-only CSP header with a host-allowlist script-src by default", () => {
    const { response } = setup({ path: "/deployments" });

    const csp = response.headers.get("Content-Security-Policy-Report-Only");
    const scriptSrc = csp?.split("; ").find(directive => directive.startsWith("script-src "));
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain(THEME_SCRIPT_HASH);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'strict-dynamic'");
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("gives every response a fresh script nonce for Cloudflare to stamp onto its injected script", () => {
    const first = setup({ path: "/" });
    const second = setup({ path: "/" });

    const firstNonce = toScriptNonce(first.response.headers.get("Content-Security-Policy-Report-Only"));
    const secondNonce = toScriptNonce(second.response.headers.get("Content-Security-Policy-Report-Only"));
    expect(firstNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(secondNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(firstNonce).not.toBe(secondNonce);
  });

  it("does not attach an x-nonce header", () => {
    const { response } = setup({ path: "/" });

    expect(response.headers.get("x-nonce")).toBeNull();
  });

  it("emits the enforcing CSP header when CSP_MODE is enforce", () => {
    vi.stubEnv("CSP_MODE", "enforce");

    const { response } = setup({ path: "/" });

    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
  });

  it.each(["/sw.js", "/workbox-4754cb34.js", "/manifest.json", "/api/healthz"])("serves %s during maintenance instead of redirecting it", path => {
    vi.stubEnv("MAINTENANCE_MODE", "true");

    const { response } = setup({ path });

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("still applies the CSP header to the service worker script", () => {
    const { response } = setup({ path: "/sw.js" });

    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain("script-src 'self'");
  });

  it("carries the original path and query into the maintenance return param", () => {
    vi.stubEnv("MAINTENANCE_MODE", "true");

    const { response } = setup({ path: "/deployments?network=sandbox" });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`http://localhost/maintenance?return=${encodeURIComponent("/deployments?network=sandbox")}`);
  });

  it("leaves an ordinary page alone while maintenance mode is off", () => {
    const { response } = setup({ path: "/deployments" });

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/maintenance", "/maintenance/details"])("serves %s itself while maintenance mode is on", path => {
    vi.stubEnv("MAINTENANCE_MODE", "true");

    const { response } = setup({ path });

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/maintenance", "/maintenance/details"])("redirects away from %s once maintenance mode is off", path => {
    const { response } = setup({ path: `${path}?return=%2Fdeployments` });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/deployments");
  });

  it("redirects to the requested relative path when leaving the maintenance page", () => {
    const { response } = setup({ path: "/maintenance?return=%2Fdeployments%3Ftab%3Dactive" });

    expect(response.headers.get("location")).toBe("http://localhost/deployments?tab=active");
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

  it("keeps a same-origin absolute return url with a protocol-relative path on the request origin", () => {
    const { response } = setup({ path: "/maintenance?return=http%3A%2F%2Flocalhost%2F%2Fevil.example%2Fphish" });

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.host).toBe("localhost");
    expect(location.hostname).not.toBe("evil.example");
  });

  it("remembers a referral code from the ref query param", () => {
    const { response } = setup({ path: "/?ref=Creator" });

    const cookie = response.cookies.get(REFERRAL_COOKIE_NAME);
    expect(cookie?.value).toBe("creator");
    expect(cookie?.path).toBe("/");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.maxAge).toBe(REFERRAL_COOKIE_MAX_AGE_SECONDS);
  });

  it("marks the referral cookie secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const { response } = setup({ path: "/?ref=creator" });

    expect(response.cookies.get(REFERRAL_COOKIE_NAME)?.secure).toBe(true);
  });

  it("overwrites an existing referral cookie with the most recently opened link", () => {
    const { response } = setup({ path: "/?ref=newcode", existingReferralCookie: "oldcode" });

    expect(response.cookies.get(REFERRAL_COOKIE_NAME)?.value).toBe("newcode");
  });

  it("ignores an invalid ref query param", () => {
    const { response } = setup({ path: "/?ref=bad%20space" });

    expect(response.cookies.get(REFERRAL_COOKIE_NAME)).toBeUndefined();
  });

  it("leaves the referral cookie untouched without a ref query param", () => {
    const { response } = setup({ path: "/" });

    expect(response.cookies.get(REFERRAL_COOKIE_NAME)).toBeUndefined();
  });

  function setup(input: { path: string; sentryDsn?: string; violationReportDraw?: number; existingReferralCookie?: string }) {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", input.sentryDsn ?? "");
    vi.spyOn(Math, "random").mockReturnValue(input.violationReportDraw ?? 1);
    const request = new NextRequest(new URL(`http://localhost${input.path}`), {
      headers: input.existingReferralCookie ? { cookie: `${REFERRAL_COOKIE_NAME}=${input.existingReferralCookie}` } : undefined
    });
    const response = middleware(request);
    return { request, response };
  }
});

function toScriptNonce(policy: string | null) {
  return policy?.match(/script-src [^;]*'nonce-([^']+)'/)?.[1];
}
