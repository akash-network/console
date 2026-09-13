import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
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
    const { service, logger } = setup({ outages: [outage] });

    const found = await service.findOutagesOlderThanDays(3);

    expect(found).toEqual([{ provider: "akash1dark", hostUri: "https://dark:8443", startedAt: "2026-08-01T00:00:00.000Z" }]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs under its own name", () => {
    const { createLogger } = setup({ outages: [] });

    expect(createLogger).toHaveBeenCalledWith({ context: ProviderOutagesHttpService.name });
  });

  it("skips an outage the inventory has not re-checked within the freshness window and keeps the fresh ones", async () => {
    const fresh = anOutage({ provider: "akash1fresh", lastAttemptAt: hoursAgo(FRESHNESS_WINDOW_IN_H - 1) });
    const stale = anOutage({ provider: "akash1stale", lastAttemptAt: hoursAgo(FRESHNESS_WINDOW_IN_H + 1) });
    const { service, logger } = setup({ outages: [fresh, stale] });

    const found = await service.findOutagesOlderThanDays(3);

    expect(found.map(outage => outage.provider)).toEqual(["akash1fresh"]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "PROVIDER_OUTAGES_STALE_SKIPPED", staleCount: 1, outageCount: 2, providers: ["akash1stale"] })
    );
  });

  it("keeps an outage re-checked exactly at the edge of the freshness window", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-13T12:00:00.000Z") });
    try {
      const edge = anOutage({ provider: "akash1edge", lastAttemptAt: hoursAgo(FRESHNESS_WINDOW_IN_H) });
      const { service } = setup({ outages: [edge] });

      const found = await service.findOutagesOlderThanDays(3);

      expect(found.map(outage => outage.provider)).toEqual(["akash1edge"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses the whole answer when the inventory has not re-checked any of the outages within the freshness window", async () => {
    const stale = anOutage({ provider: "akash1stale", lastAttemptAt: hoursAgo(FRESHNESS_WINDOW_IN_H + 1) });
    const other = anOutage({ provider: "akash1other", lastAttemptAt: hoursAgo(FRESHNESS_WINDOW_IN_H + 2) });
    const { service, logger } = setup({ outages: [stale, other] });

    await expect(service.findOutagesOlderThanDays(3)).rejects.toThrow(
      "Provider inventory last checked every one of 2 ongoing outages more than 3h ago, so its record cannot be acted on (akash1stale, akash1other)"
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("names at most ten of the stale providers when refusing the answer", async () => {
    const stale = Array.from({ length: 11 }, (_, index) => anOutage({ provider: `akash1stale${index}`, lastAttemptAt: hoursAgo(FRESHNESS_WINDOW_IN_H + 1) }));
    const { service } = setup({ outages: stale });

    const failure = await service.findOutagesOlderThanDays(3).catch((error: Error) => error.message);

    expect(failure).toContain("akash1stale9");
    expect(failure).not.toContain("akash1stale10");
  });

  it("returns an empty list without complaint when the inventory reports no ongoing outages", async () => {
    const { service } = setup({ outages: [] });

    await expect(service.findOutagesOlderThanDays(3)).resolves.toEqual([]);
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
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    return { service: new ProviderOutagesHttpService(config, createLogger), config, fetchMock, logger, createLogger };
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
