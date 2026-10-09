import type { InternalAxiosRequestConfig } from "axios";
import { AxiosHeaders } from "axios";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { requestExecutionContext } from "@src/lib/nextjs/requestExecutionContext";
import { activeOrganizationForwardingInterceptor, createActiveOrganizationForwardingFetch } from "./active-organization-forwarding.interceptor";

describe(activeOrganizationForwardingInterceptor.name, () => {
  it("sets x-organization-id from the console_org cookie of the current request", () => {
    const { config } = setup({ cookieHeader: "theme=dark; console_org=acme-corp" });

    expect(config.headers.get("x-organization-id")).toBe("acme-corp");
  });

  it("leaves the request untouched when the current request has no console_org cookie", () => {
    const { config } = setup({ cookieHeader: "theme=dark" });

    expect(config.headers.has("x-organization-id")).toBe(false);
  });

  it("drops a console_org cookie whose value is not an organization id", () => {
    const { config } = setup({ cookieHeader: "console_org=Acme%20Corp" });

    expect(config.headers.has("x-organization-id")).toBe(false);
  });

  it("leaves the request untouched outside of a request context", () => {
    const { config } = setup({});

    expect(config.headers.has("x-organization-id")).toBe(false);
  });

  function setup(input: { cookieHeader?: string }) {
    const config = mock<InternalAxiosRequestConfig>({ headers: new AxiosHeaders() });
    const intercept = () => activeOrganizationForwardingInterceptor(config);
    const requestContext = input.cookieHeader === undefined ? undefined : { headers: new Headers({ cookie: input.cookieHeader }) };

    return { config: requestContext ? requestExecutionContext.run(requestContext, intercept) : intercept() };
  }
});

describe(createActiveOrganizationForwardingFetch.name, () => {
  it("adds x-organization-id from the console_org cookie of the current request", async () => {
    const { fetchImpl, response } = await setup({ cookieHeader: "theme=dark; console_org=acme-corp" });

    expect(getSentHeaders(fetchImpl).get("x-organization-id")).toBe("acme-corp");
    expect(response.status).toBe(204);
  });

  it("keeps the request url, method and headers of the caller", async () => {
    const { fetchImpl } = await setup({ cookieHeader: "console_org=acme-corp", init: { method: "POST", headers: { authorization: "Bearer token" } } });

    expect(fetchImpl).toHaveBeenCalledWith("http://api.test/v1/organizations", expect.objectContaining({ method: "POST" }));
    expect(getSentHeaders(fetchImpl).get("authorization")).toBe("Bearer token");
  });

  it("passes the request through unchanged when the current request has no console_org cookie", async () => {
    const init = { method: "GET", headers: { authorization: "Bearer token" } };
    const { fetchImpl } = await setup({ cookieHeader: "theme=dark", init });

    expect(fetchImpl).toHaveBeenCalledWith("http://api.test/v1/organizations", init);
  });

  it("passes the request through unchanged outside of a request context", async () => {
    const { fetchImpl } = await setup({});

    expect(fetchImpl).toHaveBeenCalledWith("http://api.test/v1/organizations", undefined);
  });

  function getSentHeaders(fetchImpl: Mock<typeof fetch>) {
    return new Headers(fetchImpl.mock.calls[0]![1]?.headers);
  }

  async function setup(input: { cookieHeader?: string; init?: RequestInit }) {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const forwardingFetch = createActiveOrganizationForwardingFetch(fetchImpl);
    const send = () => forwardingFetch("http://api.test/v1/organizations", input.init);
    const response = await (input.cookieHeader === undefined ? send() : requestExecutionContext.run({ headers: new Headers({ cookie: input.cookieHeader }) }, send));

    return { fetchImpl, response };
  }
});
