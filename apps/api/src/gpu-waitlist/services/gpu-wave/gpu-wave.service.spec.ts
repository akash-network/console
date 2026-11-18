import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import type { GpuWaitlistEntryRepository, GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import type { GpuWaitlistPoolRepository, GpuWaitlistPoolRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { GpuAvailableNoticeJob } from "@src/gpu-waitlist/services/gpu-available-notice/gpu-available-notice.job";
import type {
  HardwareRequestAccountService,
  HardwareRequestAccountType
} from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import { GpuWaveService } from "./gpu-wave.service";

const HOUR_MS = 60 * 60 * 1000;
const POOL_KEY = "nvidia:h100";

describe(GpuWaveService.name, () => {
  describe("startWave", () => {
    it("emails the first people in line with the new wave number", async () => {
      const { service, jobQueueService, entries } = setup({ entries: [entry("a"), entry("b"), entry("c"), entry("d")], pool: { waveNumber: 4 } });

      const recipients = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2.5);

      expect(recipients).toEqual(["a", "b", "c"]);
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(3);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new GpuAvailableNoticeJob({ entryId: entries[0].id, waveNumber: 5, priceUsdPerHour: 2.5 }));
    });

    it("skips trial users and keeps their place", async () => {
      const { service, jobQueueService, updatedEntries } = setup({
        entries: [entry("trial"), entry("a"), entry("b"), entry("c"), entry("d")],
        accountTypes: { trial: "trial" }
      });

      const recipients = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);

      expect(recipients).toEqual(["a", "b", "c"]);
      expect(jobQueueService.enqueue).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entryId: "trial" }) }));
      expect(updatedEntries.has("trial")).toBe(false);
    });

    it("emails a user who was in trial once the wallet is no longer trialing", async () => {
      const { service } = setup({ entries: [entry("former-trial"), entry("a")], accountTypes: { "former-trial": "paying" } });

      expect(await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2)).toEqual(["former-trial", "a"]);
    });

    it("does not email anyone more than twice a day", async () => {
      const { service } = setup({
        entries: [entry("maxed", { lastNotifiedAt: hoursAgo(5), notifiedCount: 2 }), entry("a")],
        pool: { waveStartedAt: null }
      });

      expect(await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2)).toEqual(["a"]);
    });

    it("counts emails afresh once the last one is older than a day", async () => {
      const { service, updatedEntries } = setup({
        entries: [entry("rested", { lastNotifiedAt: hoursAgo(25), notifiedCount: 2 })],
        pool: { waveStartedAt: null }
      });

      expect(await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2)).toEqual(["rested"]);
      expect(updatedEntries.get("rested")).toEqual(expect.objectContaining({ notifiedCount: 1 }));
    });

    it("emails the next people in line in the following wave", async () => {
      const entries = ["a", "b", "c", "d", "e", "f"].map(name => entry(name));
      const { service, pool } = setup({ entries, pool: { waveStartedAt: null, waveNumber: 0 } });

      const first = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);
      const second = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);

      expect(first).toEqual(["a", "b", "c"]);
      expect(second).toEqual(["d", "e", "f"]);
      expect(pool.waveNumber).toBe(2);
    });

    it("does not email anyone twice for the same wave", async () => {
      const { service } = setup({ entries: [entry("a"), entry("b")], pool: { waveStartedAt: null } });

      const first = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);
      const second = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);

      expect(first).toEqual(["a", "b"]);
      expect(second).toEqual([]);
    });

    it("emails three people for one free node of eight when everyone wants eight", async () => {
      const { service, jobQueueService } = setup({ entries: Array.from({ length: 10 }, (_, index) => entry(`e${index}`, { gpuCount: 8 })) });

      const recipients = await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);

      expect(recipients).toHaveLength(3);
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(3);
    });

    it("runs the pool lock, the entry updates and every enqueue in one transaction", async () => {
      const { service, txService, poolRepository } = setup({ entries: [entry("a")] });

      await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(poolRepository.findByPoolKeyAndLock).toHaveBeenCalledWith(POOL_KEY);
    });

    it("opens the wave on the pool", async () => {
      const { service, pool } = setup({ entries: [entry("a")], pool: { waveStartedAt: null, waveNumber: 1 } });

      await service.startWave(POOL_KEY, { nodeFreeUnits: [8] }, 2);

      expect(pool.waveNumber).toBe(2);
      expect(pool.waveStartedAt).toBeInstanceOf(Date);
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

  function hoursAgo(hours: number) {
    return new Date(Date.now() - hours * HOUR_MS);
  }

  function setup(input: { entries: GpuWaitlistEntryRow[]; pool?: Partial<GpuWaitlistPoolRow>; accountTypes?: Record<string, HardwareRequestAccountType> }) {
    const pool = mock<GpuWaitlistPoolRow>({ poolKey: POOL_KEY, waveStartedAt: null, waveNumber: 0, ...input.pool });
    const updatedEntries = new Map<string, Partial<GpuWaitlistEntryRow>>();

    const unscopedEntryRepository = mock<GpuWaitlistEntryRepository>();
    unscopedEntryRepository.updateById.mockImplementation((async (id: string, payload: Partial<GpuWaitlistEntryRow>) => {
      const stored = input.entries.find(candidate => candidate.id === id)!;
      Object.assign(stored, payload);
      updatedEntries.set(id, payload);
    }) as GpuWaitlistEntryRepository["updateById"]);
    const entryRepository = mock<GpuWaitlistEntryRepository>({
      findWaitingInPoolAcrossOrganizations: vi.fn(async () => [...input.entries]),
      unscoped: vi.fn(() => unscopedEntryRepository)
    });

    const poolRepository = mock<GpuWaitlistPoolRepository>({
      upsert: vi.fn(async () => undefined),
      findByPoolKeyAndLock: vi.fn(async () => pool),
      update: vi.fn(async (_poolKey, values) => {
        Object.assign(pool, values);
      })
    });

    const accountService = mock<HardwareRequestAccountService>({
      findAccountType: vi.fn(async ({ userId }) => input.accountTypes?.[userId.replace("user-", "")] ?? "paying")
    });
    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>({ transaction: vi.fn(async cb => await cb()) as TxService["transaction"] });
    const config = { GPU_WAITLIST_WAVE_MULTIPLIER: 3, GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY: 2 } as GpuWaitlistConfig;

    const service = new GpuWaveService(entryRepository, poolRepository, accountService, jobQueueService, txService, config);

    return { service, jobQueueService, txService, entryRepository, poolRepository, pool, entries: input.entries, updatedEntries };
  }
});
