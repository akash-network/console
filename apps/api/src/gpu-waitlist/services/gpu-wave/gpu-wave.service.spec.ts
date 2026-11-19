import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import type { GpuWaitlistEntryRepository, GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import type { GpuWaitlistPoolRepository, GpuWaitlistPoolRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { GpuAvailableNoticeJob } from "@src/gpu-waitlist/services/gpu-available-notice/gpu-available-notice.job";
import { GpuWaitlistEligibilityService } from "@src/gpu-waitlist/services/gpu-waitlist-eligibility/gpu-waitlist-eligibility.service";
import type {
  HardwareRequestAccountService,
  HardwareRequestAccountType
} from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import { GpuWaveService } from "./gpu-wave.service";

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date("2026-11-18T12:00:00.000Z");
const POOL_KEY = "nvidia:h100";
const ONE_NODE_OF_EIGHT = { nodeFreeUnits: [8] };

describe(GpuWaveService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("startWave", () => {
    it("emails the first people in line with the new wave number", async () => {
      const { service, jobQueueService, entries } = setup({ entries: names("a", "b", "c", "d"), pool: { waveNumber: 4 } });

      const recipients = await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2.5);

      expect(recipients).toEqual(["a", "b", "c"]);
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(3);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new GpuAvailableNoticeJob({ entryId: entries[0].id, waveNumber: 5, pricePerGpuUsdPerHour: 2.5 }));
    });

    it("skips trial users and keeps their place", async () => {
      const { service, jobQueueService, updatedEntries } = setup({ entries: names("trial", "a", "b", "c", "d"), accountTypes: { trial: "trial" } });

      const recipients = await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(recipients).toEqual(["a", "b", "c"]);
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(3);
      expect(updatedEntries.has("trial")).toBe(false);
    });

    it("emails a skipped trial user first in a later episode once the account is no longer trialing", async () => {
      const { service, accountTypes } = setup({ entries: names("former-trial", "a"), accountTypes: { "former-trial": "trial" } });

      const whileTrialing = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);
      const episodeCloses = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);
      accountTypes["former-trial"] = "paying";
      const afterUpgrade = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);

      expect(whileTrialing).toEqual(["a"]);
      expect(episodeCloses).toEqual([]);
      expect(afterUpgrade).toEqual(["former-trial", "a"]);
    });

    it("does not email anyone more than twice a day", async () => {
      const { service } = setup({ entries: [entry("maxed", { lastNotifiedAt: hoursAgo(5), notifiedCount: 2 }), entry("a")] });

      expect(await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2)).toEqual(["a"]);
    });

    it("counts emails afresh once the last one is older than a day", async () => {
      const { service, updatedEntries } = setup({ entries: [entry("rested", { lastNotifiedAt: hoursAgo(25), notifiedCount: 2 })] });

      expect(await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2)).toEqual(["rested"]);
      expect(updatedEntries.get("rested")).toEqual(expect.objectContaining({ notifiedCount: 1 }));
    });

    it("counts emails afresh when the last one went out exactly a day ago", async () => {
      const { service, updatedEntries } = setup({ entries: [entry("on-the-dot", { lastNotifiedAt: hoursAgo(24), notifiedCount: 2 })] });

      expect(await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2)).toEqual(["on-the-dot"]);
      expect(updatedEntries.get("on-the-dot")).toEqual(expect.objectContaining({ notifiedCount: 1 }));
    });

    it("reaches new people in line order in every round of one episode", async () => {
      const { service, pool } = setup({ entries: names("a", "b", "c", "d", "e", "f", "g", "h", "i") });

      const rounds = [
        await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2),
        await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2),
        await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2)
      ];

      expect(rounds).toEqual([
        ["a", "b", "c"],
        ["d", "e", "f"],
        ["g", "h", "i"]
      ]);
      expect(pool.waveNumber).toBe(3);
      expect(pool.waveStartedAt).toEqual(NOW);
    });

    it("does not email anyone twice for the same wave", async () => {
      const { service } = setup({ entries: names("a", "b") });

      const first = await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);
      const second = await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(first).toEqual(["a", "b"]);
      expect(second).toEqual([]);
    });

    it("closes the episode without a new round when nobody is left to email", async () => {
      const { service, pool, jobQueueService } = setup({ entries: names("a"), pool: { waveNumber: 1 } });
      await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);
      const roundAt = pool.lastRoundAt;
      vi.setSystemTime(new Date(NOW.getTime() + HOUR_MS));

      const recipients = await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(recipients).toEqual([]);
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(pool).toEqual(expect.objectContaining({ waveStartedAt: null, waveNumber: 2, lastRoundAt: roundAt }));
    });

    it("leaves a pool without an open episode alone when nobody is left to email", async () => {
      const { service, poolRepository } = setup({ entries: [] });

      expect(await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2)).toEqual([]);
      expect(poolRepository.update).not.toHaveBeenCalled();
    });

    it("opens a new episode on a later supply rise", async () => {
      const { service, pool } = setup({ entries: names("a", "b") });
      await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);
      await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);
      vi.setSystemTime(new Date(NOW.getTime() + HOUR_MS));

      const recipients = await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(recipients).toEqual(["a", "b"]);
      expect(pool.waveStartedAt).toEqual(new Date(NOW.getTime() + HOUR_MS));
    });

    it("emails three people for one free node of eight when everyone wants eight", async () => {
      const { service, jobQueueService } = setup({ entries: names(...Array.from({ length: 10 }, (_, index) => `e${index}`)) });

      const recipients = await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(recipients).toHaveLength(3);
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(3);
    });

    it("treats an unlimited node as large enough for everyone in line", async () => {
      const { service } = setup({ entries: names("a", "b", "c", "d") });

      const recipients = await service.startWave(POOL_KEY, { nodeFreeUnits: [Number.MAX_SAFE_INTEGER] }, 2);

      expect(recipients).toEqual(["a", "b", "c", "d"]);
    });

    it("checks only as many wallets as the free supply can serve", async () => {
      const { service, accountService } = setup({ entries: names(...Array.from({ length: 30 }, (_, index) => `e${index}`)) });

      await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(accountService.findAccountType).toHaveBeenCalledTimes(10);
    });

    it("reaches into the next chunk of wallets when trial users fill the first", async () => {
      const entries = names(...Array.from({ length: 30 }, (_, index) => `e${index + 1}`));
      const trial = Object.fromEntries(entries.slice(0, 9).map(({ id }) => [id, "trial" as const]));
      const { service } = setup({ entries, accountTypes: trial });

      const recipients = await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(recipients).toEqual(["e10", "e11", "e12"]);
    });

    it("counts a slot that opens in a later chunk of wallets", async () => {
      const entries = [
        ...names(...Array.from({ length: 10 }, (_, index) => `big${index}`)),
        entry("small", { gpuCount: 2 }),
        ...names("tail0", "tail1", "tail2", "tail3")
      ];
      const { service } = setup({ entries });

      const recipients = await service.startWave(POOL_KEY, { nodeFreeUnits: [8, 2] }, 2);

      expect(recipients).toEqual(["big0", "big1", "big2", "big3", "big4", "big5"]);
    });

    it("emails everyone in line when small requests keep fitting across chunks", async () => {
      const entries = Array.from({ length: 30 }, (_, index) => entry(`e${index}`, { gpuCount: 1 }));
      const { service } = setup({ entries });

      const recipients = await service.startWave(POOL_KEY, { nodeFreeUnits: [100] }, 2);

      expect(recipients).toEqual(entries.map(({ id }) => id));
    });

    it("does not check the wallet of anyone over the daily limit", async () => {
      const { service, accountService } = setup({ entries: [entry("maxed", { lastNotifiedAt: hoursAgo(5), notifiedCount: 2 })] });

      await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(accountService.findAccountType).not.toHaveBeenCalled();
    });

    it("runs the pool lock, the entry updates, the pool update and every enqueue inside the transaction", async () => {
      const { service, insideTransactionAtCall } = setup({ entries: names("a", "b") });

      await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(insideTransactionAtCall).toHaveLength(2 + 2 + 1 + 1);
      expect(insideTransactionAtCall.every(Boolean)).toBe(true);
    });

    it("logs and emails nobody when the pool row does not exist", async () => {
      const { service, jobQueueService, logger } = setup({ entries: names("a"), pool: null });

      const recipients = await service.startWave(POOL_KEY, ONE_NODE_OF_EIGHT, 2);

      expect(recipients).toEqual([]);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "GPU_WAVE_POOL_NOT_FOUND", poolKey: POOL_KEY });
    });
  });

  function entry(id: string, overrides: Partial<GpuWaitlistEntryRow> = {}) {
    return mock<GpuWaitlistEntryRow>({
      id,
      userId: `user-${id}`,
      organizationId: null,
      gpuCount: 8,
      lastNotifiedAt: null,
      notifiedCount: 0,
      status: "waiting",
      ...overrides
    });
  }

  function names(...ids: string[]) {
    return ids.map(id => entry(id));
  }

  function hoursAgo(hours: number) {
    return new Date(NOW.getTime() - hours * HOUR_MS);
  }

  function setup(input: {
    entries: GpuWaitlistEntryRow[];
    pool?: Partial<GpuWaitlistPoolRow> | null;
    accountTypes?: Record<string, HardwareRequestAccountType>;
  }) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    const insideTransactionAtCall: boolean[] = [];
    let insideTransaction = false;
    const accountTypes = { ...input.accountTypes };
    const pool = mock<GpuWaitlistPoolRow>({ poolKey: POOL_KEY, waveStartedAt: null, lastRoundAt: null, waveNumber: 0, ...input.pool });

    const unscopedEntryRepository = mock<GpuWaitlistEntryRepository>();
    const updatedEntries = new Map<string, Partial<GpuWaitlistEntryRow>>();
    unscopedEntryRepository.updateById.mockImplementation((async (id: string, payload: Partial<GpuWaitlistEntryRow>) => {
      insideTransactionAtCall.push(insideTransaction);
      Object.assign(input.entries.find(candidate => candidate.id === id)!, payload);
      updatedEntries.set(id, payload);
    }) as GpuWaitlistEntryRepository["updateById"]);
    const entryRepository = mock<GpuWaitlistEntryRepository>({
      findWaitingInPoolAcrossOrganizations: vi.fn(async () => [...input.entries]),
      unscoped: vi.fn(() => unscopedEntryRepository)
    });

    const poolRepository = mock<GpuWaitlistPoolRepository>({
      findByPoolKeyAndLock: vi.fn(async () => {
        insideTransactionAtCall.push(insideTransaction);
        return input.pool === null ? undefined : pool;
      }),
      update: vi.fn(async (_poolKey, values) => {
        insideTransactionAtCall.push(insideTransaction);
        Object.assign(pool, values);
      })
    });

    const accountService = mock<HardwareRequestAccountService>({
      findAccountType: vi.fn(async ({ userId }) => accountTypes[userId!.replace("user-", "")] ?? "paying")
    });
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockImplementation(async () => {
      insideTransactionAtCall.push(insideTransaction);
      return null;
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
    const config = mock<GpuWaitlistConfig>({ GPU_WAITLIST_WAVE_MULTIPLIER: 3, GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY: 2 });
    const logger = mock<ReturnType<CreateLogger>>();

    const eligibilityService = new GpuWaitlistEligibilityService(accountService, config);
    const service = new GpuWaveService(entryRepository, poolRepository, eligibilityService, jobQueueService, txService, config, () => logger);

    return {
      service,
      jobQueueService,
      accountService,
      poolRepository,
      pool,
      entries: input.entries,
      updatedEntries,
      accountTypes,
      insideTransactionAtCall,
      logger
    };
  }
});
