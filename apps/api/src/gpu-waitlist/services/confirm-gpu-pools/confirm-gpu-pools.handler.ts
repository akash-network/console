import { subDays } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { type GpuSetup, type GpuSetupBid, GpuSetupCheckService } from "@src/deployment/services/gpu-setup-check/gpu-setup-check.service";
import { type PoolSupply, summarizePoolSupply, toGpuSetupInterface } from "@src/gpu-waitlist/lib/pool-supply/pool-supply";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { GpuWaitlistPoolRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { GpuSupplyHttpService } from "@src/gpu-waitlist/services/gpu-supply-http/gpu-supply-http.service";
import { GpuWaveService } from "@src/gpu-waitlist/services/gpu-wave/gpu-wave.service";
import { ConfirmGpuPools } from "./confirm-gpu-pools.job";

type PoolToCheck = { poolKey: string; supply: PoolSupply; setup: GpuSetup };

@singleton()
export class ConfirmGpuPoolsHandler implements JobHandler<ConfirmGpuPools> {
  public readonly accepts = ConfirmGpuPools;

  /** One check deployment at a time; the watcher keeps a pool it could not hand over due for its next run. */
  public readonly policy = "exclusive";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    private readonly gpuWaitlistPoolRepository: GpuWaitlistPoolRepository,
    private readonly gpuSupplyHttpService: GpuSupplyHttpService,
    private readonly gpuBidCheckRepository: GpuBidCheckRepository,
    private readonly gpuSetupCheckService: GpuSetupCheckService,
    private readonly gpuWaveService: GpuWaveService,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ConfirmGpuPoolsHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ poolKeys }: JobPayload<ConfirmGpuPools>): Promise<void> {
    if (!this.featureFlagsService.isEnabled(FeatureFlags.GPU_AVAILABILITY_ALERTS, {})) return;

    const now = new Date();
    const pools: PoolToCheck[] = [];

    for (const poolKey of poolKeys) {
      try {
        const pool = await this.#prepare(poolKey, now);
        if (pool) pools.push(pool);
      } catch (error) {
        this.#logger.error({ event: "GPU_WAITLIST_CONFIRM_FAILED", poolKey, error });
      }
    }

    const bidsByPool = await this.#check(pools);
    if (!bidsByPool) return;

    for (const [index, pool] of pools.entries()) {
      try {
        await this.#startWaveOnLiveBid(pool, bidsByPool[index]);
      } catch (error) {
        this.#logger.error({ event: "GPU_WAITLIST_CONFIRM_FAILED", poolKey: pool.poolKey, error });
      }
    }
  }

  async #prepare(poolKey: string, now: Date): Promise<PoolToCheck | undefined> {
    const entries = await this.gpuWaitlistEntryRepository.findWaitingInPoolAcrossOrganizations(poolKey);
    if (!entries.length) return undefined;

    const [{ vendor, model, memory, interface: gpuInterface }] = entries;
    const [rows, bidders] = await Promise.all([
      this.gpuSupplyHttpService.findSupply({ vendor, model }),
      this.gpuBidCheckRepository.findProvidersWithBidsSince({ vendor, model, since: subDays(now, this.config.GPU_WAITLIST_BID_EVIDENCE_DAYS) })
    ]);
    const supply = summarizePoolSupply(rows, new Set(bidders), { memory, interface: gpuInterface });
    const largestFreeNode = Math.max(0, ...supply.nodeFreeUnits);
    const firstFitting = entries.find(entry => entry.gpuCount <= largestFreeNode);

    if (!firstFitting) {
      this.#logger.info({ event: "GPU_WAITLIST_CONFIRM_NO_FIT", poolKey });
      return undefined;
    }

    await this.gpuWaitlistPoolRepository.update(poolKey, { lastCheckAt: now });

    return {
      poolKey,
      supply,
      setup: { vendor: "nvidia", model, memory: memory ?? undefined, interface: toGpuSetupInterface(gpuInterface), count: firstFitting.gpuCount }
    };
  }

  async #check(pools: PoolToCheck[]): Promise<GpuSetupBid[][] | undefined> {
    if (!pools.length) return undefined;

    const poolKeys = pools.map(pool => pool.poolKey);

    try {
      const outcome = await this.gpuSetupCheckService.check(pools.map(pool => pool.setup));

      if (outcome.status === "cap_reached") {
        this.#logger.warn({ event: "GPU_WAITLIST_CHECK_CAP_REACHED", poolKeys });
        return undefined;
      }

      if (outcome.status === "unavailable") {
        this.#logger.warn({ event: "GPU_WAITLIST_CHECK_UNAVAILABLE", poolKeys });
        return undefined;
      }

      return outcome.results.map(result => result.bids);
    } catch (error) {
      this.#logger.error({ event: "GPU_WAITLIST_CHECK_FAILED", poolKeys, error });
      return undefined;
    }
  }

  async #startWaveOnLiveBid({ poolKey, supply }: PoolToCheck, bids: GpuSetupBid[]): Promise<void> {
    const liveBids = bids.filter(bid => supply.providers.includes(bid.provider));

    if (!liveBids.length) {
      this.#logger.info({ event: "GPU_WAITLIST_CONFIRM_NO_LIVE_BID", poolKey });
      return;
    }

    const priceUsdPerHour = Math.min(...liveBids.map(bid => bid.priceUsdPerHour));
    await this.gpuWaitlistPoolRepository.update(poolKey, { lastCheckPriceUsdPerHour: priceUsdPerHour });
    const recipients = await this.gpuWaveService.startWave(poolKey, { nodeFreeUnits: supply.nodeFreeUnits }, priceUsdPerHour);

    this.#logger.info({ event: "GPU_WAITLIST_CONFIRM_WAVE_STARTED", poolKey, priceUsdPerHour, recipientCount: recipients.length });
  }
}
