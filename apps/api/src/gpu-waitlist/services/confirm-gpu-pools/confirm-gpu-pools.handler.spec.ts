import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import type { GpuSetup, GpuSetupBid, GpuSetupCheckOutcome, GpuSetupCheckService } from "@src/deployment/services/gpu-setup-check/gpu-setup-check.service";
import type { GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import type { GpuWaitlistEntryRepository, GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import type { GpuWaitlistPoolRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import type { GpuSupplyHttpService, GpuSupplyRow } from "@src/gpu-waitlist/services/gpu-supply-http/gpu-supply-http.service";
import type { GpuWaveService } from "@src/gpu-waitlist/services/gpu-wave/gpu-wave.service";
import { ConfirmGpuPoolsHandler } from "./confirm-gpu-pools.handler";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const H100 = "nvidia/h100/*/*";
const A100 = "nvidia/a100/80gi/sxm5";

describe(ConfirmGpuPoolsHandler.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups every due pool into one check", async () => {
    const { handler, gpuSetupCheckService } = setup({
      pools: {
        [H100]: { gpuCounts: [8], supply: [{ units: 8 }] },
        [A100]: { gpuCounts: [2], memory: "80Gi", interface: "SXM5", supply: [{ memory: "80Gi", interface: "sxm5", units: 4 }] }
      }
    });

    await handler.handle({ poolKeys: [H100, A100], version: 1 });

    expect(gpuSetupCheckService.check).toHaveBeenCalledTimes(1);
    expect(gpuSetupCheckService.check).toHaveBeenCalledWith([
      { vendor: "nvidia", model: "h100", memory: undefined, interface: undefined, count: 8 },
      { vendor: "nvidia", model: "a100", memory: "80Gi", interface: "sxm", count: 2 }
    ]);
  });

  it("asks for the first request in line that fits the largest free node", async () => {
    const { handler, checkedSetups } = setup({ pools: { [H100]: { gpuCounts: [16, 4, 2], supply: [{ units: 8 }] } } });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(checkedSetups().map(({ count }) => count)).toEqual([4]);
  });

  it("leaves out an interface no check can ask for", async () => {
    const { handler, checkedSetups } = setup({ pools: { [H100]: { gpuCounts: [1], interface: "nvlink", supply: [{ interface: "nvlink", units: 8 }] } } });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(checkedSetups()[0].interface).toBeUndefined();
  });

  it("starts a wave only when a provider holding the free gpus bids", async () => {
    const { handler, gpuWaveService, gpuWaitlistPoolRepository, logger } = setup({
      pools: {
        [H100]: { gpuCounts: [8], supply: [{ owner: "holder", units: 8 }], bids: [bid("elsewhere", 1), bid("holder", 3)] },
        [A100]: { gpuCounts: [1], supply: [{ owner: "holder", memory: "80Gi", interface: "sxm5", units: 2 }], bids: [bid("elsewhere", 1)] }
      },
      bidders: ["holder", "elsewhere"]
    });

    await handler.handle({ poolKeys: [H100, A100], version: 1 });

    expect(gpuWaveService.startWave).toHaveBeenCalledTimes(1);
    expect(gpuWaveService.startWave).toHaveBeenCalledWith(H100, { nodeFreeUnits: [8] }, 3);
    expect(gpuWaitlistPoolRepository.update).toHaveBeenCalledWith(H100, { lastCheckPriceUsdPerHour: 3 });
    expect(gpuWaitlistPoolRepository.update).not.toHaveBeenCalledWith(A100, { lastCheckPriceUsdPerHour: expect.anything() });
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_NO_LIVE_BID", poolKey: A100 });
  });

  it("starts the wave at the lowest price a provider holding the free gpus bid", async () => {
    const { handler, gpuWaveService, logger } = setup({
      pools: {
        [H100]: {
          gpuCounts: [1],
          supply: [
            { owner: "a", units: 2 },
            { owner: "b", units: 2 }
          ],
          bids: [bid("a", 5), bid("b", 4)]
        }
      },
      bidders: ["a", "b"],
      recipients: ["entry-1", "entry-2"]
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuWaveService.startWave).toHaveBeenCalledWith(H100, { nodeFreeUnits: [2, 2] }, 4);
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_WAVE_STARTED", poolKey: H100, priceUsdPerHour: 4, recipientCount: 2 });
  });

  it("does not check free gpus of a provider without recent bid evidence", async () => {
    const { handler, gpuSetupCheckService, gpuBidCheckRepository, logger } = setup({
      pools: { [H100]: { gpuCounts: [1], supply: [{ owner: "silent", units: 8 }] } },
      bidders: ["holder"]
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuSetupCheckService.check).not.toHaveBeenCalled();
    expect(gpuBidCheckRepository.findProvidersWithBidsSince).toHaveBeenCalledWith({
      vendor: "nvidia",
      model: "h100",
      since: new Date("2026-11-11T12:00:00.000Z")
    });
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_NO_FIT", poolKey: H100 });
  });

  it("logs and stops when the daily cap is reached", async () => {
    const { handler, gpuWaveService, gpuWaitlistPoolRepository, logger } = setup({
      pools: { [H100]: { gpuCounts: [8], supply: [{ units: 8 }] } },
      outcome: { status: "cap_reached" }
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(logger.warn).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CHECK_CAP_REACHED", poolKeys: [H100] });
    expect(gpuWaveService.startWave).not.toHaveBeenCalled();
    expect(gpuWaitlistPoolRepository.update).not.toHaveBeenCalledWith(H100, { lastCheckPriceUsdPerHour: expect.anything() });
  });

  it("logs and stops when no check can run", async () => {
    const { handler, gpuWaveService, logger } = setup({ pools: { [H100]: { gpuCounts: [8], supply: [{ units: 8 }] } }, outcome: { status: "unavailable" } });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(logger.warn).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CHECK_UNAVAILABLE", poolKeys: [H100] });
    expect(gpuWaveService.startWave).not.toHaveBeenCalled();
  });

  it("marks every pool checked before the check runs, so a failing check still honours the cooldown", async () => {
    const error = new Error("chain down");
    const { handler, calls, logger } = setup({ pools: { [H100]: { gpuCounts: [8], supply: [{ units: 8 }] } }, checkError: error });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(calls).toEqual([`update:${H100}:${JSON.stringify({ lastCheckAt: NOW })}`, "check"]);
    expect(logger.error).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CHECK_FAILED", poolKeys: [H100], error });
  });

  it("does not mark or check a pool whose free gpus fit nobody", async () => {
    const { handler, gpuSetupCheckService, gpuWaitlistPoolRepository, logger } = setup({ pools: { [H100]: { gpuCounts: [8], supply: [{ units: 4 }] } } });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuSetupCheckService.check).not.toHaveBeenCalled();
    expect(gpuWaitlistPoolRepository.update).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_NO_FIT", poolKey: H100 });
  });

  it("skips a pool nobody waits in anymore", async () => {
    const { handler, gpuSetupCheckService, gpuSupplyHttpService } = setup({ pools: { [H100]: { gpuCounts: [], supply: [{ units: 8 }] } } });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuSupplyHttpService.findSupply).not.toHaveBeenCalled();
    expect(gpuSetupCheckService.check).not.toHaveBeenCalled();
  });

  it("keeps confirming the other pools when one fails", async () => {
    const waveError = new Error("lock timeout");
    const { handler, gpuWaveService, gpuSetupCheckService, logger } = setup({
      pools: {
        [H100]: { gpuCounts: [1], supply: [{ units: 8 }], bids: [bid("bidder", 2)] },
        [A100]: { gpuCounts: [1], memory: "80Gi", interface: "SXM5", supply: [{ memory: "80Gi", interface: "sxm5", units: 8 }], bids: [bid("bidder", 2)] },
        "nvidia/broken/*/*": { gpuCounts: [1], supply: [{ units: 8 }] }
      },
      failingModels: ["broken"]
    });
    gpuWaveService.startWave.mockImplementation(async poolKey => {
      if (poolKey === H100) throw waveError;
      return ["entry"];
    });

    await handler.handle({ poolKeys: ["nvidia/broken/*/*", H100, A100], version: 1 });

    expect(gpuSetupCheckService.check).toHaveBeenCalledWith([expect.objectContaining({ model: "h100" }), expect.objectContaining({ model: "a100" })]);
    expect(gpuWaveService.startWave).toHaveBeenCalledWith(A100, { nodeFreeUnits: [8] }, 2);
    expect(logger.error).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_FAILED", poolKey: "nvidia/broken/*/*", error: expect.any(Error) });
    expect(logger.error).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_FAILED", poolKey: H100, error: waveError });
  });

  it("does nothing while the feature is off", async () => {
    const { handler, featureFlagsService, gpuSetupCheckService, gpuWaitlistEntryRepository } = setup({
      pools: { [H100]: { gpuCounts: [8], supply: [{ units: 8 }] } },
      flagEnabled: false
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.GPU_AVAILABILITY_ALERTS, {});
    expect(gpuWaitlistEntryRepository.findWaitingInPoolAcrossOrganizations).not.toHaveBeenCalled();
    expect(gpuSetupCheckService.check).not.toHaveBeenCalled();
  });

  function bid(provider: string, priceUsdPerHour: number): GpuSetupBid {
    return { provider, priceUsdPerHour };
  }

  function setup(input: {
    pools: Record<string, { gpuCounts: number[]; supply: Partial<GpuSupplyRow>[]; bids?: GpuSetupBid[]; memory?: string; interface?: string }>;
    bidders?: string[];
    failingModels?: string[];
    flagEnabled?: boolean;
    outcome?: GpuSetupCheckOutcome;
    checkError?: Error;
    recipients?: string[];
  }) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    const pools = Object.entries(input.pools).map(([poolKey, pool]) => ({ ...pool, poolKey, model: poolKey.split("/")[1] }));
    const calls: string[] = [];

    const gpuWaitlistEntryRepository = mock<GpuWaitlistEntryRepository>({
      findWaitingInPoolAcrossOrganizations: vi.fn(async (poolKey: string) => {
        const pool = pools.find(candidate => candidate.poolKey === poolKey)!;
        return pool.gpuCounts.map((gpuCount, index) =>
          anEntry({ poolKey, model: pool.model, memory: pool.memory, interface: pool.interface, gpuCount, index })
        );
      })
    });
    const gpuWaitlistPoolRepository = mock<GpuWaitlistPoolRepository>({
      update: vi.fn(async (poolKey, values) => {
        calls.push(`update:${poolKey}:${JSON.stringify(values)}`);
      })
    });
    const gpuSupplyHttpService = mock<GpuSupplyHttpService>({
      findSupply: vi.fn(async ({ model }) => {
        if (input.failingModels?.includes(model)) throw new Error("inventory down");
        return pools.find(pool => pool.model === model)!.supply.map((row, index) => aSupplyRow({ model, node: index + 1, ...row }));
      })
    });
    const gpuBidCheckRepository = mock<GpuBidCheckRepository>({ findProvidersWithBidsSince: vi.fn(async () => input.bidders ?? ["bidder"]) });
    const gpuSetupCheckService = mock<GpuSetupCheckService>({
      check: vi.fn(async (setups: GpuSetup[]): Promise<GpuSetupCheckOutcome> => {
        calls.push("check");
        if (input.checkError) throw input.checkError;
        return (
          input.outcome ?? {
            status: "checked",
            results: setups.map(setup => ({ setup, bids: pools.find(pool => pool.model === setup.model)!.bids ?? [] }))
          }
        );
      })
    });
    const gpuWaveService = mock<GpuWaveService>({ startWave: vi.fn(async () => input.recipients ?? []) });
    const featureFlagsService = mock<FeatureFlagsService>({ isEnabled: vi.fn(() => input.flagEnabled ?? true) });
    const config = mock<GpuWaitlistConfig>({ GPU_WAITLIST_BID_EVIDENCE_DAYS: 7 });
    const logger = mock<ReturnType<CreateLogger>>();

    const handler = new ConfirmGpuPoolsHandler(
      featureFlagsService,
      gpuWaitlistEntryRepository,
      gpuWaitlistPoolRepository,
      gpuSupplyHttpService,
      gpuBidCheckRepository,
      gpuSetupCheckService,
      gpuWaveService,
      config,
      () => logger
    );

    function checkedSetups() {
      return gpuSetupCheckService.check.mock.calls[0][0];
    }

    return {
      handler,
      featureFlagsService,
      gpuWaitlistEntryRepository,
      gpuWaitlistPoolRepository,
      gpuSupplyHttpService,
      gpuBidCheckRepository,
      gpuSetupCheckService,
      gpuWaveService,
      logger,
      calls,
      checkedSetups
    };
  }

  function anEntry(input: { poolKey: string; model: string; memory?: string; interface?: string; gpuCount: number; index: number }): GpuWaitlistEntryRow {
    return {
      id: `${input.poolKey}-${input.index}`,
      userId: `user-${input.index}`,
      organizationId: null,
      vendor: "nvidia",
      model: input.model,
      memory: input.memory ?? null,
      interface: input.interface ?? null,
      poolKey: input.poolKey,
      gpuCount: input.gpuCount,
      source: "gpu_menu",
      status: "waiting",
      joinedAt: NOW,
      lastNotifiedAt: null,
      notifiedCount: 0,
      stillWantedAskedAt: null,
      endedAt: null,
      createdAt: NOW,
      updatedAt: NOW
    };
  }

  function aSupplyRow(overrides: Partial<GpuSupplyRow>): GpuSupplyRow {
    return { owner: "bidder", node: 1, vendor: "nvidia", model: "h100", memory: "80Gi", interface: "sxm5", units: 8, nodeFreeUnits: null, ...overrides };
  }
});
