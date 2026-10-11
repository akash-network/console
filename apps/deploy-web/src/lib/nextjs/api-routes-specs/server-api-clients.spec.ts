import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";

import { requestExecutionContext } from "@src/lib/nextjs/requestExecutionContext";
import { services } from "@src/services/app-di-container/server-di-container.service";

describe("server API clients", () => {
  it("sends the console_org cookie as x-organization-id from the console API client", async () => {
    const { sentConfig } = await sendThroughAxios({ client: services.consoleApiHttpClient });

    expect(sentConfig.headers.get("x-organization-id")).toBe("acme-corp");
  });

  it("sends no x-organization-id from the session client used to sign in", async () => {
    const { sentConfig } = await sendThroughAxios({ client: services.sessionApiHttpClient });

    expect(sentConfig.headers.has("x-organization-id")).toBe(false);
  });

  it("sends the console_org cookie as x-organization-id from the API SDK", async () => {
    const { sentHeaders } = await sendThroughApiSdk();

    expect(sentHeaders.get("x-organization-id")).toBe("acme-corp");
  });

  function runInRequestWithActiveOrganization<T>(send: () => Promise<T>) {
    return requestExecutionContext.run({ headers: new Headers({ cookie: "console_org=acme-corp" }) }, send);
  }

  async function sendThroughAxios(input: { client: typeof services.consoleApiHttpClient }) {
    const adapter = vi.fn<AxiosAdapter>(async config => ({ data: {}, status: 200, statusText: "OK", headers: {}, config }));
    await runInRequestWithActiveOrganization(() => input.client.get("http://api.test/v1/organizations", { adapter }));

    return { sentConfig: adapter.mock.calls[0]![0] as InternalAxiosRequestConfig };
  }

  async function sendThroughApiSdk() {
    const upstreamFetch = vi.fn<typeof fetch>(async () => Response.json({ data: [] }));
    vi.stubGlobal("fetch", upstreamFetch);
    try {
      await runInRequestWithActiveOrganization(() => services.api.v1.listDeployments({}));
    } finally {
      vi.unstubAllGlobals();
    }

    return { sentHeaders: new Headers(upstreamFetch.mock.calls[0]![1]?.headers) };
  }
});
