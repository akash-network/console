import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiProviderList } from "@src/types/provider";
import { findFirstReachableProvider, PROVIDER_PROBE_CONCURRENCY } from "./findFirstReachableProvider";

describe("findFirstReachableProvider", () => {
  it("returns the provider that responds", async () => {
    const { providers, probe } = setup({ count: 3, reachable: ["provider-2"] });

    await expect(findFirstReachableProvider(providers, probe)).resolves.toBe(providers[1]);
  });

  it("returns null when no provider responds", async () => {
    const { providers, probe } = setup({ count: 3, reachable: [] });

    await expect(findFirstReachableProvider(providers, probe)).resolves.toBeNull();
  });

  it("returns null for an empty candidate list without probing", async () => {
    const { probe } = setup({ count: 0, reachable: [] });

    await expect(findFirstReachableProvider([], probe)).resolves.toBeNull();
    expect(probe).not.toHaveBeenCalled();
  });

  it("probes at most one batch at a time", async () => {
    const { providers, probe, maxConcurrent } = setup({ count: PROVIDER_PROBE_CONCURRENCY * 3, reachable: [] });

    await findFirstReachableProvider(providers, probe);

    expect(maxConcurrent()).toBe(PROVIDER_PROBE_CONCURRENCY);
  });

  it("advances to the next batch only when every probe in the current one fails", async () => {
    const target = `provider-${PROVIDER_PROBE_CONCURRENCY + 1}`;
    const { providers, probe } = setup({ count: PROVIDER_PROBE_CONCURRENCY * 2, reachable: [target] });

    const found = await findFirstReachableProvider(providers, probe);

    expect(found?.owner).toBe(target);
    expect(probe).toHaveBeenCalledTimes(PROVIDER_PROBE_CONCURRENCY * 2);
  });

  it("leaves later batches unprobed once a provider responds", async () => {
    const { providers, probe } = setup({ count: PROVIDER_PROBE_CONCURRENCY * 3, reachable: ["provider-1"] });

    await findFirstReachableProvider(providers, probe);

    expect(probe).toHaveBeenCalledTimes(PROVIDER_PROBE_CONCURRENCY);
  });

  function setup(input: { count: number; reachable: string[] }) {
    const providers = Array.from({ length: input.count }, (_, index) =>
      mock<ApiProviderList>({ owner: `provider-${index + 1}`, hostUri: `https://provider-${index + 1}.example` })
    );
    let inFlight = 0;
    let peak = 0;
    const probe = vi.fn(async (provider: ApiProviderList) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      if (!input.reachable.includes(provider.owner)) throw new Error(`${provider.owner} unreachable`);
    });
    return { providers, probe, maxConcurrent: () => peak };
  }
});
