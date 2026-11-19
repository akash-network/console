import { inject, singleton } from "tsyringe";

import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import type { GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import type { GpuWaitlistPoolRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { HardwareRequestAccountService } from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";

const DAY_MS = 24 * 60 * 60 * 1000;

export type GpuWaitlistEpisode = Pick<GpuWaitlistPoolRow, "waveStartedAt"> | undefined;

@singleton()
export class GpuWaitlistEligibilityService {
  constructor(
    private readonly hardwareRequestAccountService: HardwareRequestAccountService,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig
  ) {}

  isWithinEmailLimits(entry: GpuWaitlistEntryRow, episode: GpuWaitlistEpisode, now: Date): boolean {
    if (episode?.waveStartedAt && entry.lastNotifiedAt && entry.lastNotifiedAt >= episode.waveStartedAt) return false;

    return this.emailsInLastDay(entry, now) < this.config.GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY;
  }

  emailsInLastDay(entry: GpuWaitlistEntryRow, now: Date): number {
    return entry.lastNotifiedAt && now.getTime() - entry.lastNotifiedAt.getTime() < DAY_MS ? entry.notifiedCount : 0;
  }

  async isNotTrialing(entry: GpuWaitlistEntryRow): Promise<boolean> {
    return (await this.hardwareRequestAccountService.findAccountType({ userId: entry.userId, organizationId: entry.organizationId })) !== "trial";
  }

  /** Reads accounts only for entries within their email limits, in line order, and stops at the first eligible one. */
  async findFirstEligible(entries: GpuWaitlistEntryRow[], episode: GpuWaitlistEpisode, now: Date): Promise<GpuWaitlistEntryRow | undefined> {
    for (const entry of entries) {
      if (this.isWithinEmailLimits(entry, episode, now) && (await this.isNotTrialing(entry))) return entry;
    }

    return undefined;
  }
}
