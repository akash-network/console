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

  function setup(input: { path: string }) {
    const request = new NextRequest(new URL(`http://localhost${input.path}`));
    const response = middleware(request);
    return { request, response };
  }
});
