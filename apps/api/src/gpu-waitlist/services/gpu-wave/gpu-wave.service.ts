import { inject, singleton } from "tsyringe";

import { JobQueueService } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import { planWave } from "@src/gpu-waitlist/lib/plan-wave/plan-wave";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository, type GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { GpuWaitlistPoolRepository, type GpuWaitlistPoolRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { GpuAvailableNoticeJob } from "@src/gpu-waitlist/services/gpu-available-notice/gpu-available-notice.job";
import { HardwareRequestAccountService } from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";

const DAY_MS = 24 * 60 * 60 * 1000;

export type GpuSupply = { nodeFreeUnits: number[] };

@singleton()
export class GpuWaveService {
  constructor(
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    private readonly gpuWaitlistPoolRepository: GpuWaitlistPoolRepository,
    private readonly hardwareRequestAccountService: HardwareRequestAccountService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig
  ) {}

  async startWave(poolKey: string, supply: GpuSupply, priceUsdPerHour: number): Promise<string[]> {
    return await this.txService.transaction(async () => {
      const pool = await this.#lockPool(poolKey, supply);
      const now = new Date();
      const entries = await this.gpuWaitlistEntryRepository.findWaitingInPoolAcrossOrganizations(poolKey);
      const candidates = await Promise.all(
        entries.map(async entry => ({ id: entry.id, gpuCount: entry.gpuCount, isEligible: await this.#isEligible(entry, pool, now) }))
      );
      const recipients = planWave({ nodeFreeUnits: supply.nodeFreeUnits, entries: candidates, multiplier: this.config.GPU_WAITLIST_WAVE_MULTIPLIER });
      const waveNumber = pool.waveNumber + 1;

      for (const entry of entries.filter(({ id }) => recipients.includes(id))) {
        await this.#notify(entry, { waveNumber, priceUsdPerHour, now });
      }

      await this.gpuWaitlistPoolRepository.update(poolKey, { waveStartedAt: now, waveNumber });

      return recipients;
    });
  }

  async #lockPool(poolKey: string, supply: GpuSupply): Promise<GpuWaitlistPoolRow> {
    await this.gpuWaitlistPoolRepository.upsert({
      poolKey,
      lastFreeUnits: supply.nodeFreeUnits.reduce((total, units) => total + units, 0),
      lastMaxNodeFreeUnits: Math.max(0, ...supply.nodeFreeUnits)
    });

    return (await this.gpuWaitlistPoolRepository.findByPoolKeyAndLock(poolKey))!;
  }

  async #isEligible(entry: GpuWaitlistEntryRow, pool: GpuWaitlistPoolRow, now: Date): Promise<boolean> {
    if (pool.waveStartedAt && entry.lastNotifiedAt && entry.lastNotifiedAt >= pool.waveStartedAt) return false;
    if (this.#emailsInLastDay(entry, now) >= this.config.GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY) return false;

    const accountType = await this.hardwareRequestAccountService.findAccountType({ userId: entry.userId, organizationId: entry.organizationId });

    return accountType !== "trial";
  }

  #emailsInLastDay(entry: GpuWaitlistEntryRow, now: Date): number {
    return entry.lastNotifiedAt && now.getTime() - entry.lastNotifiedAt.getTime() < DAY_MS ? entry.notifiedCount : 0;
  }

  async #notify(entry: GpuWaitlistEntryRow, { waveNumber, priceUsdPerHour, now }: { waveNumber: number; priceUsdPerHour: number; now: Date }): Promise<void> {
    await this.gpuWaitlistEntryRepository
      .unscoped("gpu-waitlist-watcher")
      .updateById(entry.id, { lastNotifiedAt: now, notifiedCount: this.#emailsInLastDay(entry, now) + 1 });
    await this.jobQueueService.enqueue(new GpuAvailableNoticeJob({ entryId: entry.id, waveNumber, priceUsdPerHour }));
  }
}
