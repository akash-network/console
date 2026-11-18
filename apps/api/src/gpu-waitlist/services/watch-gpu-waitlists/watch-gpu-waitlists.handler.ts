import { addSeconds, subDays, subMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type EnqueueOptions, type JobHandler, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { MAX_GPU_SETUPS_PER_CHECK } from "@src/deployment/services/gpu-setup-check/gpu-setup-check.service";
import { type PoolSupply, summarizePoolSupply } from "@src/gpu-waitlist/lib/pool-supply/pool-supply";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import {
  type GpuWaitlistPoolInput,
  GpuWaitlistPoolRepository,
  type GpuWaitlistPoolRow
} from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { CONFIRM_GPU_POOLS_KEY, ConfirmGpuPools } from "@src/gpu-waitlist/services/confirm-gpu-pools/confirm-gpu-pools.job";
import { GpuSupplyHttpService } from "@src/gpu-waitlist/services/gpu-supply-http/gpu-supply-http.service";
import { WatchGpuWaitlists } from "./watch-gpu-waitlists.job";

export const WATCH_GPU_WAITLISTS_KEY = "watchGpuWaitlists";

/** Pool rows store supply in int4 columns, and a node reporting unlimited capacity counts as Number.MAX_SAFE_INTEGER. */
const MAX_STORED_UNITS = 2147483647;

type WatchedPool = { poolKey: string; supply: PoolSupply; isDue: boolean; closesWave: boolean; previous?: GpuWaitlistPoolRow };

@singleton()
export class WatchGpuWaitlistsHandler implements JobHandler<WatchGpuWaitlists> {
  public readonly accepts = WatchGpuWaitlists;

  /** One queued and one running watch, so the run's own rescheduling and every replica's boot seed keep a single chain going. */
  public readonly policy = "stately";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly txService: TxService,
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    private readonly gpuWaitlistPoolRepository: GpuWaitlistPoolRepository,
    private readonly gpuSupplyHttpService: GpuSupplyHttpService,
    private readonly gpuBidCheckRepository: GpuBidCheckRepository,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: WatchGpuWaitlistsHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Every replica seeds on boot whatever the flag, so turning the flag on later finds the chain running; a failure waits for the next boot. */
  async seedNextRun(): Promise<void> {
    try {
      await this.jobQueueService.enqueue(new WatchGpuWaitlists(), { singletonKey: WATCH_GPU_WAITLISTS_KEY });
    } catch (error) {
      this.#logger.error({ event: "GPU_WAITLIST_WATCH_SCHEDULE_FAILED", error });
    }
  }

  async handle(): Promise<void> {
    const now = new Date();
    await this.jobQueueService.enqueue(new WatchGpuWaitlists(), this.#nextRunOptions(now));

    if (!this.featureFlagsService.isEnabled(FeatureFlags.GPU_AVAILABILITY_ALERTS, {})) return;

    const poolKeys = await this.gpuWaitlistEntryRepository.findWaitingPoolKeysAcrossOrganizations();
    const previousByKey = new Map((await this.gpuWaitlistPoolRepository.findByPoolKeys(poolKeys)).map(pool => [pool.poolKey, pool]));
    const watched: WatchedPool[] = [];

    for (const poolKey of poolKeys) {
      try {
        const pool = await this.#watchPool(poolKey, previousByKey.get(poolKey), now);
        if (pool) watched.push(pool);
      } catch (error) {
        this.#logger.error({ event: "GPU_WAITLIST_WATCH_POOL_FAILED", poolKey, error });
      }
    }

    await this.txService.transaction(async () => {
      const handedOver = await this.#handOverDuePools(watched);

      for (const pool of watched) {
        await this.gpuWaitlistPoolRepository.upsert(this.#toPoolRow(pool, handedOver));
      }
    });
  }

  #nextRunOptions(now: Date): EnqueueOptions {
    return { singletonKey: WATCH_GPU_WAITLISTS_KEY, startAfter: addSeconds(now, this.config.GPU_WAITLIST_POLL_SECONDS).toISOString() };
  }

  async #watchPool(poolKey: string, previous: GpuWaitlistPoolRow | undefined, now: Date): Promise<WatchedPool | undefined> {
    const entries = await this.gpuWaitlistEntryRepository.findWaitingInPoolAcrossOrganizations(poolKey);
    if (!entries.length) return undefined;

    const [{ vendor, model, memory, interface: gpuInterface }] = entries;
    const [rows, bidders] = await Promise.all([
      this.gpuSupplyHttpService.findSupply({ vendor, model }),
      this.gpuBidCheckRepository.findProvidersWithBidsSince({ vendor, model, since: subDays(now, this.config.GPU_WAITLIST_BID_EVIDENCE_DAYS) })
    ]);
    const supply = summarizePoolSupply(rows, new Set(bidders), { memory, interface: gpuInterface });
    const fitsSomeone = Math.max(0, ...supply.nodeFreeUnits) >= Math.min(...entries.map(entry => entry.gpuCount));

    return {
      poolKey,
      supply,
      previous,
      isDue: fitsSomeone && this.#isCooledDown(previous, now) && (this.#hasRisen(supply, previous) || this.#isRoundDue(previous, now)),
      closesWave: !fitsSomeone && !!previous?.waveStartedAt
    };
  }

  #isCooledDown(previous: GpuWaitlistPoolRow | undefined, now: Date): boolean {
    return !previous?.lastCheckAt || previous.lastCheckAt <= subMinutes(now, this.config.GPU_WAITLIST_CHECK_COOLDOWN_MINUTES);
  }

  #hasRisen(supply: PoolSupply, previous: GpuWaitlistPoolRow | undefined): boolean {
    return toStoredUnits(supply.freeUnits) > (previous?.lastFreeUnits ?? 0);
  }

  #isRoundDue(previous: GpuWaitlistPoolRow | undefined, now: Date): boolean {
    if (!previous?.waveStartedAt) return false;

    return !previous.lastRoundAt || previous.lastRoundAt <= subMinutes(now, this.config.GPU_WAITLIST_WAVE_WINDOW_MINUTES);
  }

  async #handOverDuePools(watched: WatchedPool[]): Promise<Set<string>> {
    const poolKeys = watched
      .filter(pool => pool.isDue)
      .map(pool => pool.poolKey)
      .slice(0, MAX_GPU_SETUPS_PER_CHECK);
    if (!poolKeys.length) return new Set();

    const jobId = await this.jobQueueService.enqueue(new ConfirmGpuPools({ poolKeys }), { singletonKey: CONFIRM_GPU_POOLS_KEY });

    return new Set(jobId ? poolKeys : []);
  }

  /** A due pool no confirmation took keeps its previous free count, so it is still due on the next watch. */
  #toPoolRow({ poolKey, supply, isDue, closesWave, previous }: WatchedPool, handedOver: Set<string>): GpuWaitlistPoolInput {
    const isLeftDue = isDue && !handedOver.has(poolKey);

    return {
      poolKey,
      lastFreeUnits: isLeftDue ? previous?.lastFreeUnits ?? 0 : toStoredUnits(supply.freeUnits),
      lastMaxNodeFreeUnits: toStoredUnits(Math.max(0, ...supply.nodeFreeUnits)),
      ...(closesWave && { waveStartedAt: null })
    };
  }
}

function toStoredUnits(units: number): number {
  return Math.min(units, MAX_STORED_UNITS);
}
