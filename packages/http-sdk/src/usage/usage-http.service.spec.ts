import type { InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";

import { UsageHttpService } from "./usage-http.service";

describe(UsageHttpService.name, () => {
  it.each([
    { method: "getUsage", url: "/v1/usage/history" },
    { method: "getUsageStats", url: "/v1/usage/history/stats" }
  ] as const)("asks $url for the UTC days it is given", async ({ method, url }) => {
    const { service, sentRequests } = setup();

    await service[method]({ address: "akash1abc", startDate: "2026-09-25", endDate: "2026-10-24" });

    expect(sentRequests()).toEqual([expect.objectContaining({ url, params: { address: "akash1abc", startDate: "2026-09-25", endDate: "2026-10-24" } })]);
  });

  it("returns the usage the api answers with", async () => {
    const usage = [{ date: "2026-10-24", dailyUsdSpent: 1.5 }];
    const { service } = setup({ data: usage });

    await expect(service.getUsage({ address: "akash1abc" })).resolves.toEqual(usage);
  });

  function setup(input: { data?: unknown } = {}) {
    const requests: InternalAxiosRequestConfig[] = [];
    const service = new UsageHttpService({
      adapter: async config => {
        requests.push(config);
        return { data: input.data ?? [], status: 200, statusText: "OK", headers: {}, config };
      }
    });

    return { service, sentRequests: () => requests };
  }
});
