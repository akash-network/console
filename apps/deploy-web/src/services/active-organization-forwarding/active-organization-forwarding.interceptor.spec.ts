import type { InternalAxiosRequestConfig } from "axios";
import { AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { requestExecutionContext } from "@src/lib/nextjs/requestExecutionContext";
import { activeOrganizationForwardingInterceptor } from "./active-organization-forwarding.interceptor";

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
