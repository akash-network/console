import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";

import { getActiveOrganizationCookieName } from "@src/lib/active-organization/active-organization-cookie";
import { requestExecutionContext } from "@src/lib/nextjs/requestExecutionContext";
import { services } from "@src/services/app-di-container/server-di-container.service";

describe("server API clients", () => {
  it("sends the organization cookie as x-organization-id from the console API client", async () => {
    const { sentConfig } = await sendThroughAxios({ client: services.consoleApiHttpClient });

    expect(sentConfig.headers.get("x-organization-id")).toBe("acme-corp");
  });

  it("sends no x-organization-id from the session client used to sign in", async () => {
    const { sentConfig } = await sendThroughAxios({ client: services.sessionApiHttpClient });

    expect(sentConfig.headers.has("x-organization-id")).toBe(false);
  });

  it("sends the organization cookie as x-organization-id from the API SDK", async () => {
    const { sentHeaders } = await sendThroughApiSdk();

    expect(sentHeaders.get("x-organization-id")).toBe("acme-corp");
  });

  async function runInRequestWithActiveOrganization<T>(send: () => Promise<T>) {
    const consoleUrl = "https://console.test";
    const privateConfig = vi.spyOn(services, "privateConfig", "get").mockReturnValue({ AUTH0_BASE_URL: consoleUrl } as typeof services.privateConfig);
    const cookieName = getActiveOrganizationCookieName(new URL(consoleUrl));
    try {
      return await requestExecutionContext.run({ headers: new Headers({ cookie: `${cookieName}=acme-corp` }) }, send);
    } finally {
      privateConfig.mockRestore();
    }
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
