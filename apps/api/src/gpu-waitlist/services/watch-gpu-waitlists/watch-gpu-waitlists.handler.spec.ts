import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import type { GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import type { GpuWaitlistEntryRepository, GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import type {
  GpuWaitlistPoolInput,
  GpuWaitlistPoolRepository,
  GpuWaitlistPoolRow
} from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { ConfirmGpuPools } from "@src/gpu-waitlist/services/confirm-gpu-pools/confirm-gpu-pools.job";
import type { GpuSupplyHttpService, GpuSupplyRow } from "@src/gpu-waitlist/services/gpu-supply-http/gpu-supply-http.service";
import { GpuWaitlistEligibilityService } from "@src/gpu-waitlist/services/gpu-waitlist-eligibility/gpu-waitlist-eligibility.service";
import type { GpuWaitlistNetworkService } from "@src/gpu-waitlist/services/gpu-waitlist-network/gpu-waitlist-network.service";
import type {
  HardwareRequestAccountService,
  HardwareRequestAccountType
} from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import { WatchGpuWaitlistsHandler } from "./watch-gpu-waitlists.handler";
import { WatchGpuWaitlists } from "./watch-gpu-waitlists.job";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const MINUTE_MS = 60 * 1000;
const INT4_MAX = 2147483647;

describe(WatchGpuWaitlistsHandler.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("handle", () => {
    it("confirms a pool when free supply rises and fits someone", async () => {
      const { handler, jobQueueService, upserts } = setup({ pools: { h100: { gpuCounts: [8, 2], supply: [{ units: 8 }], pool: { lastFreeUnits: 4 } } } });

      await handler.handle();

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ConfirmGpuPools({ poolKeys: ["nvidia/h100/*/*"] }), { singletonKey: "confirmGpuPools" });
      expect(upserts).toEqual([{ poolKey: "nvidia/h100/*/*", lastFreeUnits: 8, lastMaxNodeFreeUnits: 8 }]);
    });

    it("confirms a pool it sees for the first time and creates its row", async () => {
      const { handler, upserts, confirmedPoolKeys } = setup({ pools: { h100: { gpuCounts: [1], supply: [{ units: 2 }] } } });

      await handler.handle();

      expect(confirmedPoolKeys()).toEqual(["nvidia/h100/*/*"]);
      expect(upserts).toEqual([{ poolKey: "nvidia/h100/*/*", lastFreeUnits: 2, lastMaxNodeFreeUnits: 2 }]);
    });

    it("does not confirm when supply is unchanged", async () => {
      const { handler, confirmedPoolKeys, upserts } = setup({ pools: { h100: { gpuCounts: [8], supply: [{ units: 8 }], pool: { lastFreeUnits: 8 } } } });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
      expect(upserts).toEqual([{ poolKey: "nvidia/h100/*/*", lastFreeUnits: 8, lastMaxNodeFreeUnits: 8 }]);
    });

    it("does not confirm when no single node fits the smallest request", async () => {
      const { handler, confirmedPoolKeys } = setup({
        pools: {
          h100: {
            gpuCounts: [8, 6],
            supply: [
              { node: 1, units: 4 },
              { node: 2, units: 4 }
            ],
            pool: { lastFreeUnits: 0 }
          }
        }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
    });

    it("ignores free gpus of providers without recent bid evidence", async () => {
      const { handler, confirmedPoolKeys, gpuBidCheckRepository } = setup({
        pools: { h100: { gpuCounts: [1], supply: [{ owner: "silent", units: 8 }] } },
        bidders: ["bidder"]
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
      expect(gpuBidCheckRepository.findProvidersWithBidsSince).toHaveBeenCalledWith({
        vendor: "nvidia",
        model: "h100",
        since: new Date(NOW.getTime() - 7 * 24 * 60 * MINUTE_MS)
      });
    });

    it("matches the pool's memory and interface against the supply", async () => {
      const { handler, upserts } = setup({
        pools: {
          h100: {
            gpuCounts: [1],
            memory: "80Gi",
            interface: "SXM5",
            supply: [
              { node: 1, memory: "80Gi", interface: "sxm5", units: 2 },
              { node: 2, memory: "94Gi", interface: "sxm5", units: 4 }
            ]
          }
        }
      });

      await handler.handle();

      expect(upserts).toEqual([{ poolKey: "nvidia/h100/80gi/sxm5", lastFreeUnits: 2, lastMaxNodeFreeUnits: 2 }]);
    });

    it("waits for the cooldown between checks", async () => {
      const { handler, confirmedPoolKeys, upserts } = setup({
        pools: {
          h100: { gpuCounts: [1], supply: [{ units: 8 }], pool: { lastFreeUnits: 0, lastCheckAt: minutesAgo(14) } },
          a100: { gpuCounts: [1], supply: [{ units: 8 }], pool: { lastFreeUnits: 0, lastCheckAt: minutesAgo(15) } }
        }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toEqual(["nvidia/a100/*/*"]);
      expect(upserts).toEqual([
        { poolKey: "nvidia/h100/*/*", lastFreeUnits: 0, lastMaxNodeFreeUnits: 8 },
        { poolKey: "nvidia/a100/*/*", lastFreeUnits: 8, lastMaxNodeFreeUnits: 8 }
      ]);
    });

    it("confirms a rise held back by the cooldown once the cooldown ends", async () => {
      const { handler, jobQueueService, confirmedPoolKeys } = setup({
        pools: { h100: { gpuCounts: [1], supply: [{ units: 8 }], pool: { lastFreeUnits: 0, lastCheckAt: minutesAgo(14) } } }
      });

      await handler.handle();
      const confirmedDuringCooldown = confirmedPoolKeys();
      jobQueueService.enqueue.mockClear();
      vi.setSystemTime(new Date(NOW.getTime() + MINUTE_MS));
      await handler.handle();

      expect(confirmedDuringCooldown).toBeUndefined();
      expect(confirmedPoolKeys()).toEqual(["nvidia/h100/*/*"]);
    });

    it("confirms another round of an open wave once its window has passed and supply still fits", async () => {
      const { handler, confirmedPoolKeys } = setup({
        pools: {
          h100: {
            gpuCounts: [8],
            supply: [{ units: 8 }],
            pool: { lastFreeUnits: 8, waveStartedAt: minutesAgo(30), lastRoundAt: minutesAgo(10), lastCheckAt: minutesAgo(30) }
          },
          a100: {
            gpuCounts: [8],
            supply: [{ units: 8 }],
            pool: { lastFreeUnits: 8, waveStartedAt: minutesAgo(30), lastRoundAt: minutesAgo(9), lastCheckAt: minutesAgo(30) }
          },
          l40s: {
            gpuCounts: [8],
            supply: [{ units: 8 }],
            pool: { lastFreeUnits: 8, waveStartedAt: minutesAgo(30), lastRoundAt: minutesAgo(10), lastCheckAt: minutesAgo(14) }
          }
        }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toEqual(["nvidia/h100/*/*"]);
    });

    it("does not check a wave closed for lack of a live bid again until supply rises", async () => {
      const { handler, confirmedPoolKeys } = setup({
        pools: {
          h100: {
            gpuCounts: [8],
            supply: [{ units: 8 }],
            pool: { lastFreeUnits: 8, waveStartedAt: null, lastRoundAt: minutesAgo(60), lastCheckAt: minutesAgo(16) }
          }
        }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
    });

    it("closes the wave once supply no longer fits", async () => {
      const { handler, upserts, confirmedPoolKeys } = setup({
        pools: {
          h100: { gpuCounts: [8], supply: [{ units: 4 }], pool: { lastFreeUnits: 8, waveStartedAt: minutesAgo(30), lastRoundAt: minutesAgo(30) } },
          a100: { gpuCounts: [8], supply: [{ units: 8 }], pool: { lastFreeUnits: 8, waveStartedAt: minutesAgo(30), lastRoundAt: minutesAgo(5) } }
        }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
      expect(upserts).toEqual([
        { poolKey: "nvidia/h100/*/*", lastFreeUnits: 4, lastMaxNodeFreeUnits: 4, waveStartedAt: null },
        { poolKey: "nvidia/a100/*/*", lastFreeUnits: 8, lastMaxNodeFreeUnits: 8 }
      ]);
    });

    it("clamps the supply of a node reporting unlimited capacity to what the pool row holds", async () => {
      const { handler, upserts } = setup({ pools: { h100: { gpuCounts: [1], supply: [{ units: Number.MAX_SAFE_INTEGER, nodeFreeUnits: null }] } } });

      await handler.handle();

      expect(upserts).toEqual([{ poolKey: "nvidia/h100/*/*", lastFreeUnits: INT4_MAX, lastMaxNodeFreeUnits: INT4_MAX }]);
    });

    it("does not see unlimited supply rise again once it is stored", async () => {
      const { handler, confirmedPoolKeys } = setup({
        pools: { h100: { gpuCounts: [1], supply: [{ units: Number.MAX_SAFE_INTEGER, nodeFreeUnits: null }], pool: { lastFreeUnits: INT4_MAX } } }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
    });

    it("hands at most 20 pools to a confirmation and keeps the rest due", async () => {
      const models = Array.from({ length: 21 }, (_, index) => `model${index}`);
      const { handler, confirmedPoolKeys, upserts } = setup({
        pools: Object.fromEntries(models.map(model => [model, { gpuCounts: [1], supply: [{ units: 2 }], pool: { lastFreeUnits: 1 } }]))
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toEqual(models.slice(0, 20).map(model => `nvidia/${model}/*/*`));
      expect(upserts.at(-1)).toEqual({ poolKey: "nvidia/model20/*/*", lastFreeUnits: 1, lastMaxNodeFreeUnits: 2 });
    });

    it("keeps due pools due when a confirmation is already queued", async () => {
      const { handler, upserts } = setup({
        pools: { h100: { gpuCounts: [1], supply: [{ units: 2 }], pool: { lastFreeUnits: 1 } }, a100: { gpuCounts: [1], supply: [{ units: 2 }] } },
        confirmationQueued: true
      });

      await handler.handle();

      expect(upserts).toEqual([
        { poolKey: "nvidia/h100/*/*", lastFreeUnits: 1, lastMaxNodeFreeUnits: 2 },
        { poolKey: "nvidia/a100/*/*", lastFreeUnits: 0, lastMaxNodeFreeUnits: 2 }
      ]);
    });

    it("writes the supply and the confirmation together", async () => {
      const { handler, writesInsideTransaction } = setup({ pools: { h100: { gpuCounts: [1], supply: [{ units: 2 }] } } });

      await handler.handle();

      expect(writesInsideTransaction).toEqual(["enqueue:ConfirmGpuPools:true", "upsert:true"]);
    });

    it("keeps watching the other pools when one fails", async () => {
      const { handler, confirmedPoolKeys, logger, upserts } = setup({
        pools: { broken: { gpuCounts: [1], supply: [{ units: 2 }] }, h100: { gpuCounts: [1], supply: [{ units: 2 }] } },
        failingModels: ["broken"]
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toEqual(["nvidia/h100/*/*"]);
      expect(upserts.map(({ poolKey }) => poolKey)).toEqual(["nvidia/h100/*/*"]);
      expect(logger.error).toHaveBeenCalledWith({ event: "GPU_WAITLIST_WATCH_POOL_FAILED", poolKey: "nvidia/broken/*/*", error: expect.any(Error) });
    });

    it("skips a pool whose last waiting entry left meanwhile", async () => {
      const { handler, upserts, confirmedPoolKeys } = setup({ pools: { h100: { gpuCounts: [], supply: [{ units: 2 }] } } });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
      expect(upserts).toEqual([]);
    });

    it("does not confirm a pool whose only waiters a free node fits are trial users", async () => {
      const { handler, confirmedPoolKeys, accountService } = setup({
        pools: { h100: { gpuCounts: [1, 8], supply: [{ units: 2 }], pool: { lastFreeUnits: 0 }, entries: [{ userId: "trial-user" }, {}] } },
        accountTypes: { "trial-user": "trial" }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
      expect(accountService.findAccountType.mock.calls.map(([owner]) => owner.userId)).toEqual(["trial-user"]);
    });

    it("confirms a pool where a paying waiter fits behind a trial user", async () => {
      const { handler, confirmedPoolKeys } = setup({
        pools: { h100: { gpuCounts: [1, 2], supply: [{ units: 2 }], pool: { lastFreeUnits: 0 }, entries: [{ userId: "trial-user" }, {}] } },
        accountTypes: { "trial-user": "trial" }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toEqual(["nvidia/h100/*/*"]);
    });

    it("does not confirm another round when everyone a free node fits was emailed in the open episode", async () => {
      const waveStartedAt = minutesAgo(30);
      const { handler, confirmedPoolKeys, accountService } = setup({
        pools: {
          h100: {
            gpuCounts: [8, 8],
            supply: [{ units: 8 }],
            pool: { lastFreeUnits: 8, waveStartedAt, lastRoundAt: minutesAgo(20), lastCheckAt: minutesAgo(30) },
            entries: [
              { lastNotifiedAt: waveStartedAt, notifiedCount: 1 },
              { lastNotifiedAt: minutesAgo(20), notifiedCount: 1 }
            ]
          }
        }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
      expect(accountService.findAccountType).not.toHaveBeenCalled();
    });

    it("does not confirm a pool whose fitting waiters reached their daily email cap", async () => {
      const { handler, confirmedPoolKeys } = setup({
        pools: { h100: { gpuCounts: [8], supply: [{ units: 8 }], pool: { lastFreeUnits: 0 }, entries: [{ lastNotifiedAt: minutesAgo(60), notifiedCount: 2 }] } }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toBeUndefined();
    });

    it("reads a user's account once per watch, however many pools they wait in", async () => {
      const { handler, accountService, confirmedPoolKeys } = setup({
        pools: {
          h100: { gpuCounts: [1], supply: [{ units: 2 }], entries: [{ userId: "shared-user" }] },
          a100: { gpuCounts: [1], supply: [{ units: 2 }], entries: [{ userId: "shared-user" }] }
        }
      });

      await handler.handle();

      expect(confirmedPoolKeys()).toEqual(["nvidia/h100/*/*", "nvidia/a100/*/*"]);
      expect(accountService.findAccountType.mock.calls.map(([owner]) => owner.userId)).toEqual(["shared-user"]);
    });

    it("reads the account again on the next watch", async () => {
      const { handler, accountService } = setup({
        pools: { h100: { gpuCounts: [1], supply: [{ units: 2 }], entries: [{ userId: "paying-user" }] } },
        confirmationQueued: true
      });

      await handler.handle();
      await handler.handle();

      expect(accountService.findAccountType.mock.calls.map(([owner]) => owner.userId)).toEqual(["paying-user", "paying-user"]);
    });

    it("closes an open episode where only trial users fit, and does not walk it again while supply holds", async () => {
      const { handler, accountService, upserts, confirmedPoolKeys } = setup({
        pools: {
          h100: {
            gpuCounts: [8, 8],
            supply: [{ units: 8 }],
            pool: { lastFreeUnits: 8, waveStartedAt: minutesAgo(30), lastRoundAt: minutesAgo(20), lastCheckAt: minutesAgo(30) },
            entries: [{ userId: "trial-a" }, { userId: "trial-b" }]
          }
        },
        accountTypes: { "trial-a": "trial", "trial-b": "trial" }
      });

      await handler.handle();
      const readsOnFirstWatch = accountService.findAccountType.mock.calls.length;
      await handler.handle();

      expect(upserts[0]).toEqual({ poolKey: "nvidia/h100/*/*", lastFreeUnits: 8, lastMaxNodeFreeUnits: 8, waveStartedAt: null });
      expect(readsOnFirstWatch).toBe(2);
      expect(accountService.findAccountType).toHaveBeenCalledTimes(2);
      expect(confirmedPoolKeys()).toBeUndefined();
    });

    it("reads no account for a pool that is not due anyway", async () => {
      const { handler, accountService } = setup({ pools: { h100: { gpuCounts: [8], supply: [{ units: 8 }], pool: { lastFreeUnits: 8 } } } });

      await handler.handle();

      expect(accountService.findAccountType).not.toHaveBeenCalled();
    });

    it("fetches the supply of a model once for all its pools", async () => {
      const { handler, gpuSupplyHttpService, confirmedPoolKeys } = setup({
        pools: {
          "h100-80gi": { model: "h100", memory: "80Gi", gpuCounts: [1], supply: [{ units: 2 }] },
          "h100-any": { model: "H100", gpuCounts: [1], supply: [{ units: 2 }] }
        }
      });

      await handler.handle();

      expect(gpuSupplyHttpService.findSupply).toHaveBeenCalledTimes(1);
      expect(confirmedPoolKeys()).toEqual(["nvidia/h100/80gi/*", "nvidia/h100/*/*"]);
    });

    it("reschedules itself", async () => {
      const { handler, jobQueueService } = setup({ pools: {} });

      await handler.handle();

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new WatchGpuWaitlists(), {
        singletonKey: "watchGpuWaitlists",
        startAfter: new Date(NOW.getTime() + MINUTE_MS).toISOString()
      });
    });

    it("only reschedules itself while the feature is off", async () => {
      const { handler, jobQueueService, featureFlagsService, gpuWaitlistEntryRepository } = setup({
        pools: { h100: { gpuCounts: [1], supply: [{ units: 2 }] } },
        flagEnabled: false
      });

      await handler.handle();

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.GPU_AVAILABILITY_ALERTS, {});
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new WatchGpuWaitlists(), expect.anything());
      expect(gpuWaitlistEntryRepository.findWaitingPoolKeysAcrossOrganizations).not.toHaveBeenCalled();
    });
  });

  describe("on a network that does not serve gpu waitlists", () => {
    it("watches nothing and does not reschedule itself", async () => {
      const { handler, jobQueueService, gpuWaitlistEntryRepository } = setup({
        pools: { h100: { gpuCounts: [1], supply: [{ units: 2 }] } },
        servesGpuWaitlists: false
      });

      await handler.handle();

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(gpuWaitlistEntryRepository.findWaitingPoolKeysAcrossOrganizations).not.toHaveBeenCalled();
    });

    it("is not seeded at boot", async () => {
      const { handler, jobQueueService } = setup({ pools: {}, servesGpuWaitlists: false });

      await handler.seedNextRun();

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("seedNextRun", () => {
    it("queues a watch right away", async () => {
      const { handler, jobQueueService } = setup({ pools: {} });

      await handler.seedNextRun();

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new WatchGpuWaitlists(), { singletonKey: "watchGpuWaitlists" });
    });

    it("logs instead of throwing when the queue refuses it", async () => {
      const { handler, jobQueueService, logger } = setup({ pools: {} });
      const error = new Error("queue down");
      jobQueueService.enqueue.mockRejectedValue(error);

      await handler.seedNextRun();

      expect(logger.error).toHaveBeenCalledWith({ event: "GPU_WAITLIST_WATCH_SCHEDULE_FAILED", error });
    });
  });

  function minutesAgo(minutes: number) {
    return new Date(NOW.getTime() - minutes * MINUTE_MS);
  }

  function setup(input: {
    pools: Record<
      string,
      {
        gpuCounts: number[];
        supply: Partial<GpuSupplyRow>[];
        pool?: Partial<GpuWaitlistPoolRow>;
        model?: string;
        memory?: string;
        interface?: string;
        entries?: Partial<GpuWaitlistEntryRow>[];
      }
    >;
    bidders?: string[];
    failingModels?: string[];
    flagEnabled?: boolean;
    confirmationQueued?: boolean;
    servesGpuWaitlists?: boolean;
    accountTypes?: Record<string, HardwareRequestAccountType>;
  }) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    const pools = Object.entries(input.pools).map(([name, pool]) => ({
      ...pool,
      model: pool.model ?? name,
      poolKey: ["nvidia", (pool.model ?? name).toLowerCase(), pool.memory?.toLowerCase() ?? "*", pool.interface?.toLowerCase() ?? "*"].join("/")
    }));
    const writesInsideTransaction: string[] = [];
    let insideTransaction = false;
    const upserts: GpuWaitlistPoolInput[] = [];

    const gpuWaitlistEntryRepository = mock<GpuWaitlistEntryRepository>({
      findWaitingPoolKeysAcrossOrganizations: vi.fn(async () => pools.map(({ poolKey }) => poolKey)),
      findWaitingInPoolAcrossOrganizations: vi.fn(async (poolKey: string) => {
        const pool = pools.find(candidate => candidate.poolKey === poolKey)!;
        return pool.gpuCounts.map((gpuCount, index) => ({
          ...anEntry({ poolKey, model: pool.model, memory: pool.memory, interface: pool.interface, gpuCount, index }),
          ...pool.entries?.[index]
        }));
      })
    });
    const storedPools = new Map(pools.flatMap(({ poolKey, pool }) => (pool ? [[poolKey, aPoolRow({ poolKey, ...pool })] as const] : [])));
    const gpuWaitlistPoolRepository = mock<GpuWaitlistPoolRepository>({
      findByPoolKeys: vi.fn(async () => [...storedPools.values()]),
      upsert: vi.fn(async values => {
        writesInsideTransaction.push(`upsert:${insideTransaction}`);
        upserts.push(values);
        storedPools.set(values.poolKey, { ...(storedPools.get(values.poolKey) ?? aPoolRow({ poolKey: values.poolKey })), ...values });
      })
    });
    const gpuSupplyHttpService = mock<GpuSupplyHttpService>({
      findSupply: vi.fn(async ({ model }) => {
        if (input.failingModels?.includes(model)) throw new Error("inventory down");
        return pools.find(pool => pool.model === model)!.supply.map((row, index) => aSupplyRow({ model, node: index + 1, ...row }));
      })
    });
    const gpuBidCheckRepository = mock<GpuBidCheckRepository>({ findProvidersWithBidsSince: vi.fn(async () => input.bidders ?? ["bidder"]) });
    const featureFlagsService = mock<FeatureFlagsService>({ isEnabled: vi.fn(() => input.flagEnabled ?? true) });
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockImplementation(async job => {
      if (job instanceof ConfirmGpuPools) writesInsideTransaction.push(`enqueue:${job.name}:${insideTransaction}`);
      return job instanceof ConfirmGpuPools && input.confirmationQueued ? null : "job-id";
    });
    const txService = mock<TxService>({
      transaction: vi.fn(async cb => {
        insideTransaction = true;
        try {
          return await cb();
        } finally {
          insideTransaction = false;
        }
      }) as TxService["transaction"]
    });
    const config = mock<GpuWaitlistConfig>({
      GPU_WAITLIST_POLL_SECONDS: 60,
      GPU_WAITLIST_BID_EVIDENCE_DAYS: 7,
      GPU_WAITLIST_CHECK_COOLDOWN_MINUTES: 15,
      GPU_WAITLIST_WAVE_WINDOW_MINUTES: 10,
      GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY: 2
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const gpuWaitlistNetworkService = mock<GpuWaitlistNetworkService>({ servesGpuWaitlists: vi.fn(() => input.servesGpuWaitlists ?? true) });
    const accountService = mock<HardwareRequestAccountService>({
      findAccountType: vi.fn(async ({ userId }) => input.accountTypes?.[userId!] ?? "paying")
    });

    const handler = new WatchGpuWaitlistsHandler(
      jobQueueService,
      featureFlagsService,
      gpuWaitlistNetworkService,
      new GpuWaitlistEligibilityService(accountService, config),
      txService,
      gpuWaitlistEntryRepository,
      gpuWaitlistPoolRepository,
      gpuSupplyHttpService,
      gpuBidCheckRepository,
      config,
      () => logger
    );

    function confirmedPoolKeys() {
      const call = jobQueueService.enqueue.mock.calls.find(([job]) => job instanceof ConfirmGpuPools);
      return (call?.[0] as ConfirmGpuPools | undefined)?.data.poolKeys;
    }

    return {
      handler,
      jobQueueService,
      featureFlagsService,
      gpuWaitlistEntryRepository,
      gpuSupplyHttpService,
      gpuBidCheckRepository,
      accountService,
      logger,
      upserts,
      writesInsideTransaction,
      confirmedPoolKeys
    };
  }
});

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

function aPoolRow(overrides: Partial<GpuWaitlistPoolRow> & { poolKey: string }): GpuWaitlistPoolRow {
  return {
    lastFreeUnits: 0,
    lastMaxNodeFreeUnits: 0,
    lastCheckAt: null,
    lastCheckPriceUsdPerHour: null,
    waveStartedAt: null,
    lastRoundAt: null,
    waveNumber: 0,
    updatedAt: NOW,
    ...overrides
  };
}

function aSupplyRow(overrides: Partial<GpuSupplyRow>): GpuSupplyRow {
  return { owner: "bidder", node: 1, vendor: "nvidia", model: "h100", memory: "80Gi", interface: "sxm5", units: 8, nodeFreeUnits: null, ...overrides };
}
