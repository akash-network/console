import { inject, singleton } from "tsyringe";

import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import { countSlots, planWave, type WaveCandidate } from "@src/gpu-waitlist/lib/plan-wave/plan-wave";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository, type GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { GpuWaitlistPoolRepository, type GpuWaitlistPoolRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { GpuAvailableNoticeJob } from "@src/gpu-waitlist/services/gpu-available-notice/gpu-available-notice.job";
import { HardwareRequestAccountService } from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_CHECK_CHUNK_SIZE = 10;

export type GpuSupply = { nodeFreeUnits: number[] };

@singleton()
export class GpuWaveService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    private readonly gpuWaitlistPoolRepository: GpuWaitlistPoolRepository,
    private readonly hardwareRequestAccountService: HardwareRequestAccountService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: GpuWaveService.name });
  }

  async startWave(poolKey: string, supply: GpuSupply, priceUsdPerHour: number): Promise<string[]> {
    return await this.txService.transaction(async () => {
      const pool = await this.gpuWaitlistPoolRepository.findByPoolKeyAndLock(poolKey);

      if (!pool) {
        this.#logger.warn({ event: "GPU_WAVE_POOL_NOT_FOUND", poolKey });
        return [];
      }

      const now = new Date();
      const entries = await this.gpuWaitlistEntryRepository.findWaitingInPoolAcrossOrganizations(poolKey);
      const recipientIds = await this.#pickRecipients(entries, pool, supply, now);

      if (recipientIds.length === 0) {
        if (pool.waveStartedAt) await this.gpuWaitlistPoolRepository.update(poolKey, { waveStartedAt: null });
        return recipientIds;
      }

      const waveNumber = pool.waveNumber + 1;

      for (const entry of entries.filter(({ id }) => recipientIds.includes(id))) {
        await this.#notify(entry, { waveNumber, priceUsdPerHour, now });
      }

      await this.gpuWaitlistPoolRepository.update(poolKey, { waveNumber, lastRoundAt: now, waveStartedAt: pool.waveStartedAt ?? now });

      return recipientIds;
    });
  }

  async #pickRecipients(entries: GpuWaitlistEntryRow[], pool: GpuWaitlistPoolRow, supply: GpuSupply, now: Date): Promise<string[]> {
    const withinLimits = entries.filter(entry => this.#withinEmailLimits(entry, pool, now));
    const multiplier = this.config.GPU_WAITLIST_WAVE_MULTIPLIER;
    const evaluated: WaveCandidate[] = [];

    for (let start = 0; start < withinLimits.length; start += ACCOUNT_CHECK_CHUNK_SIZE) {
      const chunk = withinLimits.slice(start, start + ACCOUNT_CHECK_CHUNK_SIZE);
      evaluated.push(
        ...(await Promise.all(chunk.map(async entry => ({ id: entry.id, gpuCount: entry.gpuCount, isEligible: await this.#isNotTrialing(entry) }))))
      );

      const unchecked = withinLimits.slice(start + chunk.length);
      const picked = planWave({ nodeFreeUnits: supply.nodeFreeUnits, entries: evaluated, multiplier });

      if (this.#uncheckedEntriesCannotChangePick(supply, evaluated, unchecked, picked)) return picked;
    }

    return planWave({ nodeFreeUnits: supply.nodeFreeUnits, entries: evaluated, multiplier });
  }

  #uncheckedEntriesCannotChangePick(supply: GpuSupply, evaluated: WaveCandidate[], unchecked: GpuWaitlistEntryRow[], picked: string[]): boolean {
    const eligible = evaluated.filter(entry => entry.isEligible);
    const slots = countSlots(supply.nodeFreeUnits, eligible);
    const optimisticallyEligible = unchecked.map(({ id, gpuCount }) => ({ id, gpuCount, isEligible: true }));
    const slotsIfAllUncheckedWereEligible = countSlots(supply.nodeFreeUnits, [...eligible, ...optimisticallyEligible]);

    return slotsIfAllUncheckedWereEligible === slots && picked.length === this.config.GPU_WAITLIST_WAVE_MULTIPLIER * slots;
  }

  #withinEmailLimits(entry: GpuWaitlistEntryRow, pool: GpuWaitlistPoolRow, now: Date): boolean {
    if (pool.waveStartedAt && entry.lastNotifiedAt && entry.lastNotifiedAt >= pool.waveStartedAt) return false;

    return this.#emailsInLastDay(entry, now) < this.config.GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY;
  }

  async #isNotTrialing(entry: GpuWaitlistEntryRow): Promise<boolean> {
    return (await this.hardwareRequestAccountService.findAccountType({ userId: entry.userId, organizationId: entry.organizationId })) !== "trial";
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
