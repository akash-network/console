import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_SCRIPT_HASH } from "@src/lib/csp/csp";
import { middleware } from "@src/middleware";

describe("middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets a report-only CSP header with a host-allowlist script-src by default", () => {
    const { response } = setup({ path: "/deployments" });

    const csp = response.headers.get("Content-Security-Policy-Report-Only");
    const scriptSrc = csp?.split("; ").find(directive => directive.startsWith("script-src "));
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain(THEME_SCRIPT_HASH);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'strict-dynamic'");
    expect(csp).not.toContain("'nonce-");
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
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

  it.each(["/sw.js", "/workbox-4754cb34.js", "/manifest.json"])("serves %s during maintenance instead of redirecting it", path => {
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

  function setup(input: { path: string }) {
    const request = new NextRequest(new URL(`http://localhost${input.path}`));
    const response = middleware(request);
    return { request, response };
  }
});
