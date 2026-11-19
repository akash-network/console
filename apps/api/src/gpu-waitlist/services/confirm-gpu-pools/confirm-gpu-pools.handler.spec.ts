import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import type { GpuSetup, GpuSetupBid, GpuSetupCheckOutcome, GpuSetupCheckService } from "@src/deployment/services/gpu-setup-check/gpu-setup-check.service";
import type { GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import type { GpuWaitlistEntryRepository, GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import type { GpuWaitlistPoolRepository, GpuWaitlistPoolRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import type { GpuSupplyHttpService, GpuSupplyRow } from "@src/gpu-waitlist/services/gpu-supply-http/gpu-supply-http.service";
import { GpuWaitlistEligibilityService } from "@src/gpu-waitlist/services/gpu-waitlist-eligibility/gpu-waitlist-eligibility.service";
import type { GpuWaitlistNetworkService } from "@src/gpu-waitlist/services/gpu-waitlist-network/gpu-waitlist-network.service";
import type { GpuWaveService } from "@src/gpu-waitlist/services/gpu-wave/gpu-wave.service";
import type {
  HardwareRequestAccountService,
  HardwareRequestAccountType
} from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import { ConfirmGpuPoolsHandler } from "./confirm-gpu-pools.handler";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const MINUTE_MS = 60 * 1000;
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

  it("starts a wave only when a provider holding the free gpus bids, and closes the episode of a pool where none did", async () => {
    const { handler, gpuWaveService, gpuWaitlistPoolRepository, logger } = setup({
      pools: {
        [H100]: { gpuCounts: [8], supply: [{ owner: "holder", units: 8 }], bids: [bid("elsewhere", 1), bid("holder", 3)] },
        [A100]: { gpuCounts: [1], supply: [{ owner: "holder", memory: "80Gi", interface: "sxm5", units: 2 }], bids: [bid("elsewhere", 1)] }
      },
      bidders: ["holder", "elsewhere"]
    });

    await handler.handle({ poolKeys: [H100, A100], version: 1 });

    expect(gpuWaveService.startWave).toHaveBeenCalledTimes(1);
    expect(gpuWaveService.startWave).toHaveBeenCalledWith(H100, { nodeFreeUnits: [8] }, 3 / 8);
    expect(gpuWaitlistPoolRepository.update).toHaveBeenCalledWith(H100, { lastCheckPriceUsdPerHour: 3 });
    expect(gpuWaitlistPoolRepository.update).toHaveBeenCalledWith(A100, { waveStartedAt: null });
    expect(gpuWaitlistPoolRepository.update).not.toHaveBeenCalledWith(A100, { lastCheckPriceUsdPerHour: expect.anything() });
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_NO_LIVE_BID", poolKey: A100 });
  });

  it("sizes the wave on the free gpus of the providers that bid in the check", async () => {
    const { handler, gpuWaveService } = setup({
      pools: {
        [H100]: {
          gpuCounts: [1, 8, 8],
          supply: [
            { owner: "silent", node: 1, units: 8 },
            { owner: "silent", node: 2, units: 8 },
            { owner: "small", node: 1, units: 1 }
          ],
          bids: [bid("small", 2)]
        }
      },
      bidders: ["silent", "small"]
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuWaveService.startWave).toHaveBeenCalledWith(H100, { nodeFreeUnits: [1] }, 2);
  });

  it("closes the episode when the providers that bid hold too few free gpus for anyone in line", async () => {
    const { handler, gpuWaveService, gpuWaitlistPoolRepository, logger } = setup({
      pools: {
        [H100]: {
          gpuCounts: [8],
          supply: [
            { owner: "silent", node: 1, units: 8 },
            { owner: "small", node: 1, units: 1 }
          ],
          bids: [bid("small", 2)]
        }
      },
      bidders: ["silent", "small"]
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuWaveService.startWave).not.toHaveBeenCalled();
    expect(gpuWaitlistPoolRepository.update).toHaveBeenCalledWith(H100, { waveStartedAt: null });
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_NO_LIVE_BID", poolKey: H100 });
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
    expect(logger.info).toHaveBeenCalledWith({
      event: "GPU_WAITLIST_CONFIRM_WAVE_STARTED",
      poolKey: H100,
      priceUsdPerHour: 4,
      pricePerGpuUsdPerHour: 4,
      recipientCount: 2
    });
  });

  it("emails a price per gpu of the checked count and keeps the check's own price on the pool", async () => {
    const { handler, gpuWaveService, gpuWaitlistPoolRepository, checkedSetups } = setup({
      pools: { [H100]: { gpuCounts: [16, 4, 1], supply: [{ owner: "holder", units: 4 }], bids: [bid("holder", 10)] } },
      bidders: ["holder"]
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(checkedSetups()[0].count).toBe(4);
    expect(gpuWaveService.startWave).toHaveBeenCalledWith(H100, { nodeFreeUnits: [4] }, 2.5);
    expect(gpuWaitlistPoolRepository.update).toHaveBeenCalledWith(H100, { lastCheckPriceUsdPerHour: 10 });
  });

  it("asks for the first request in line that fits and whose user can be emailed", async () => {
    const { handler, checkedSetups } = setup({
      pools: {
        [H100]: {
          gpuCounts: [1, 2, 4, 8],
          supply: [{ units: 8 }],
          entries: [{ userId: "trial-user" }, { lastNotifiedAt: minutesAgo(60), notifiedCount: 2 }, {}, {}]
        }
      },
      accountTypes: { "trial-user": "trial" }
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(checkedSetups().map(({ count }) => count)).toEqual([4]);
  });

  it("skips users already emailed in the open episode when sizing the check", async () => {
    const waveStartedAt = minutesAgo(30);
    const { handler, checkedSetups } = setup({
      pools: {
        [H100]: { gpuCounts: [1, 2], supply: [{ units: 8 }], waveStartedAt, entries: [{ lastNotifiedAt: waveStartedAt, notifiedCount: 1 }, {}] }
      }
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(checkedSetups().map(({ count }) => count)).toEqual([2]);
  });

  it("does not claim or check a pool where nobody a free node fits can be emailed", async () => {
    const { handler, gpuSetupCheckService, gpuWaitlistPoolRepository, logger } = setup({
      pools: { [H100]: { gpuCounts: [1, 16], supply: [{ units: 8 }], entries: [{ userId: "trial-user" }, {}] } },
      accountTypes: { "trial-user": "trial" }
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuWaitlistPoolRepository.claimForCheck).not.toHaveBeenCalled();
    expect(gpuSetupCheckService.check).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_NO_ELIGIBLE_FIT", poolKey: H100 });
  });

  it("leaves the episode of a pool whose setup the check found invalid alone and confirms the others", async () => {
    const { handler, gpuWaveService, gpuWaitlistPoolRepository, logger } = setup({
      pools: {
        [H100]: { gpuCounts: [1], supply: [{ owner: "holder", units: 8 }], bids: [bid("holder", 2)] },
        [A100]: { gpuCounts: [1], memory: "80Gi", interface: "SXM5", supply: [{ memory: "80Gi", interface: "sxm5", units: 8 }] }
      },
      bidders: ["holder", "bidder"],
      invalidModels: ["a100"]
    });

    await handler.handle({ poolKeys: [H100, A100], version: 1 });

    expect(gpuWaveService.startWave).toHaveBeenCalledTimes(1);
    expect(gpuWaveService.startWave).toHaveBeenCalledWith(H100, expect.anything(), 2);
    expect(gpuWaitlistPoolRepository.update).not.toHaveBeenCalledWith(A100, expect.anything());
    expect(logger.warn).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_SETUP_INVALID", poolKey: A100, setup: expect.objectContaining({ model: "a100" }) });
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
    expect(gpuWaitlistPoolRepository.update).not.toHaveBeenCalled();
  });

  it("logs and stops when no check can run", async () => {
    const { handler, gpuWaveService, logger } = setup({ pools: { [H100]: { gpuCounts: [8], supply: [{ units: 8 }] } }, outcome: { status: "unavailable" } });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(logger.warn).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CHECK_UNAVAILABLE", poolKeys: [H100] });
    expect(gpuWaveService.startWave).not.toHaveBeenCalled();
  });

  it("claims every pool before the check runs, so a failing check still honours the cooldown", async () => {
    const error = new Error("chain down");
    const { handler, calls, logger } = setup({ pools: { [H100]: { gpuCounts: [8], supply: [{ units: 8 }] } }, checkError: error });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(calls).toEqual([`claim:${H100}`, "check"]);
    expect(logger.error).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CHECK_FAILED", poolKeys: [H100], error });
  });

  it("runs no second check when the job is retried inside the cooldown", async () => {
    const { handler, gpuSetupCheckService, gpuWaitlistPoolRepository, logger } = setup({
      pools: { [H100]: { gpuCounts: [8], supply: [{ units: 8 }] } },
      checkError: new Error("chain down")
    });

    await handler.handle({ poolKeys: [H100], version: 1 });
    vi.setSystemTime(new Date(NOW.getTime() + 14 * MINUTE_MS));
    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuSetupCheckService.check).toHaveBeenCalledTimes(1);
    expect(gpuWaitlistPoolRepository.claimForCheck).toHaveBeenLastCalledWith({
      poolKeys: [H100],
      checkedAt: new Date(NOW.getTime() + 14 * MINUTE_MS),
      cooledDownBefore: new Date(NOW.getTime() - MINUTE_MS)
    });
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_WAITLIST_CONFIRM_NOTHING_CLAIMED", poolKeys: [H100] });
  });

  it("checks only the pools it claimed", async () => {
    const { handler, checkedSetups } = setup({
      pools: {
        [H100]: { gpuCounts: [8], supply: [{ units: 8 }], lastCheckAt: new Date(NOW.getTime() - 5 * MINUTE_MS) },
        [A100]: { gpuCounts: [2], supply: [{ units: 8 }], lastCheckAt: new Date(NOW.getTime() - 15 * MINUTE_MS) }
      }
    });

    await handler.handle({ poolKeys: [H100, A100], version: 1 });

    expect(checkedSetups().map(({ model }) => model)).toEqual(["a100"]);
  });

  it("does not claim or check a pool whose free gpus fit nobody", async () => {
    const { handler, gpuSetupCheckService, gpuWaitlistPoolRepository, logger } = setup({ pools: { [H100]: { gpuCounts: [8], supply: [{ units: 4 }] } } });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuSetupCheckService.check).not.toHaveBeenCalled();
    expect(gpuWaitlistPoolRepository.claimForCheck).not.toHaveBeenCalled();
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

  it("does nothing on a network that does not serve gpu waitlists", async () => {
    const { handler, gpuSetupCheckService, gpuWaitlistEntryRepository, gpuWaitlistPoolRepository } = setup({
      pools: { [H100]: { gpuCounts: [8], supply: [{ units: 8 }] } },
      servesGpuWaitlists: false
    });

    await handler.handle({ poolKeys: [H100], version: 1 });

    expect(gpuWaitlistEntryRepository.findWaitingInPoolAcrossOrganizations).not.toHaveBeenCalled();
    expect(gpuWaitlistPoolRepository.claimForCheck).not.toHaveBeenCalled();
    expect(gpuSetupCheckService.check).not.toHaveBeenCalled();
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

  function setup(input: {
    pools: Record<
      string,
      {
        gpuCounts: number[];
        supply: Partial<GpuSupplyRow>[];
        bids?: GpuSetupBid[];
        memory?: string;
        interface?: string;
        lastCheckAt?: Date;
        waveStartedAt?: Date;
        entries?: Partial<GpuWaitlistEntryRow>[];
      }
    >;
    bidders?: string[];
    failingModels?: string[];
    invalidModels?: string[];
    flagEnabled?: boolean;
    servesGpuWaitlists?: boolean;
    accountTypes?: Record<string, HardwareRequestAccountType>;
    outcome?: GpuSetupCheckOutcome;
    checkError?: Error;
    recipients?: string[];
  }) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    const pools = Object.entries(input.pools).map(([poolKey, pool]) => ({ ...pool, poolKey, model: poolKey.split("/")[1] }));
    const lastCheckAtByPool = new Map(pools.flatMap(({ poolKey, lastCheckAt }) => (lastCheckAt ? [[poolKey, lastCheckAt] as const] : [])));
    const calls: string[] = [];

    const gpuWaitlistEntryRepository = mock<GpuWaitlistEntryRepository>({
      findWaitingInPoolAcrossOrganizations: vi.fn(async (poolKey: string) => {
        const pool = pools.find(candidate => candidate.poolKey === poolKey)!;
        return pool.gpuCounts.map((gpuCount, index) => ({
          ...anEntry({ poolKey, model: pool.model, memory: pool.memory, interface: pool.interface, gpuCount, index }),
          ...pool.entries?.[index]
        }));
      })
    });
    const gpuWaitlistPoolRepository = mock<GpuWaitlistPoolRepository>({
      findByPoolKeys: vi.fn(async (poolKeys: string[]) =>
        pools
          .filter(pool => poolKeys.includes(pool.poolKey))
          .map(pool => mock<GpuWaitlistPoolRow>({ poolKey: pool.poolKey, waveStartedAt: pool.waveStartedAt ?? null }))
      ),
      claimForCheck: vi.fn(async ({ poolKeys, checkedAt, cooledDownBefore }: Parameters<GpuWaitlistPoolRepository["claimForCheck"]>[0]) => {
        calls.push(`claim:${poolKeys.join(",")}`);
        const claimable = poolKeys.filter(poolKey => {
          const lastCheckAt = lastCheckAtByPool.get(poolKey);
          return !lastCheckAt || lastCheckAt <= cooledDownBefore;
        });
        claimable.forEach(poolKey => lastCheckAtByPool.set(poolKey, checkedAt));
        return claimable;
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
            results: setups.map(setup =>
              input.invalidModels?.includes(setup.model)
                ? { setup, status: "invalid", bids: [] }
                : { setup, status: "checked", bids: pools.find(pool => pool.model === setup.model)!.bids ?? [] }
            )
          }
        );
      })
    });
    const gpuWaveService = mock<GpuWaveService>({ startWave: vi.fn(async () => input.recipients ?? []) });
    const featureFlagsService = mock<FeatureFlagsService>({ isEnabled: vi.fn(() => input.flagEnabled ?? true) });
    const config = mock<GpuWaitlistConfig>({
      GPU_WAITLIST_BID_EVIDENCE_DAYS: 7,
      GPU_WAITLIST_CHECK_COOLDOWN_MINUTES: 15,
      GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY: 2
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const gpuWaitlistNetworkService = mock<GpuWaitlistNetworkService>({ servesGpuWaitlists: vi.fn(() => input.servesGpuWaitlists ?? true) });
    const accountService = mock<HardwareRequestAccountService>({
      findAccountType: vi.fn(async ({ userId }) => input.accountTypes?.[userId!] ?? "paying")
    });

    const handler = new ConfirmGpuPoolsHandler(
      featureFlagsService,
      gpuWaitlistNetworkService,
      new GpuWaitlistEligibilityService(accountService, config),
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
});

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * MINUTE_MS);
}

function bid(provider: string, priceUsdPerHour: number): GpuSetupBid {
  return { provider, priceUsdPerHour };
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
