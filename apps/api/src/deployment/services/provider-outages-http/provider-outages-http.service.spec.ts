import { describe, expect, it, vi } from "vitest";

import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { ProviderOutagesHttpService } from "./provider-outages-http.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const INVENTORY_URL = "http://provider-inventory:3092";
const FRESHNESS_WINDOW_IN_H = 3;

describe(ProviderOutagesHttpService.name, () => {
  it("asks the inventory for outages at least the requested number of days old", async () => {
    const { service, fetchMock } = setup({ outages: [] });

    await service.findOutagesOlderThanDays(3);

    expect(fetchMock).toHaveBeenCalledWith(new URL(`${INVENTORY_URL}/v1/provider-outages?minAgeDays=3`));
  });

  it("returns each unreachable provider with the host and the moment it went dark", async () => {
    const outage = anOutage({ provider: "akash1dark", hostUri: "https://dark:8443", startedAt: "2026-08-01T00:00:00.000Z" });
    const { service } = setup({ outages: [outage] });

    const found = await service.findOutagesOlderThanDays(3);

    expect(found).toEqual([{ provider: "akash1dark", hostUri: "https://dark:8443", startedAt: "2026-08-01T00:00:00.000Z" }]);
  });

  it("refuses the whole answer when the inventory has not re-checked an outage within the freshness window", async () => {
    const stale = anOutage({ lastAttemptAt: hoursAgo(FRESHNESS_WINDOW_IN_H + 1) });
    const { service } = setup({ outages: [anOutage({}), stale] });

    await expect(service.findOutagesOlderThanDays(3)).rejects.toThrow(/cannot be acted on/);
  });

  it("refuses the answer when the inventory responds with an error", async () => {
    const { service } = setup({ status: 503 });

    await expect(service.findOutagesOlderThanDays(3)).rejects.toThrow(/503/);
  });

  it("refuses an answer that does not look like an outage list", async () => {
    const { service } = setup({ body: { outages: [{ provider: "akash1dark" }] } });

    await expect(service.findOutagesOlderThanDays(3)).rejects.toThrow();
  });

  function setup(input: { outages?: unknown[]; status?: number; body?: unknown }) {
    const config = mockConfigService<DeploymentConfigService>({
      PROVIDER_INVENTORY_API_URL: INVENTORY_URL,
      PROVIDER_OUTAGE_FRESHNESS_WINDOW_IN_H: FRESHNESS_WINDOW_IN_H
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(input.body ?? { outages: input.outages ?? [] }), { status: input.status ?? 200 }));

    return { service: new ProviderOutagesHttpService(config), config, fetchMock };
  }
});

function anOutage(overrides: { provider?: string; hostUri?: string; startedAt?: string; lastAttemptAt?: string }) {
  return {
    provider: overrides.provider ?? "akash1dark",
    hostUri: overrides.hostUri ?? "https://dark:8443",
    startedAt: overrides.startedAt ?? "2026-08-01T00:00:00.000Z",
    lastAttemptAt: overrides.lastAttemptAt ?? new Date().toISOString()
  };
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}
