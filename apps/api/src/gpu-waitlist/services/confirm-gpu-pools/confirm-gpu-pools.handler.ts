import { subDays, subMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { type GpuSetup, GpuSetupCheckService, type GpuSetupResult } from "@src/deployment/services/gpu-setup-check/gpu-setup-check.service";
import { type PoolKind, type PoolSupply, summarizePoolSupply, toGpuSetupInterface } from "@src/gpu-waitlist/lib/pool-supply/pool-supply";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { GpuWaitlistPoolRepository, type GpuWaitlistPoolRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { GpuSupplyHttpService, type GpuSupplyRow } from "@src/gpu-waitlist/services/gpu-supply-http/gpu-supply-http.service";
import { GpuWaitlistEligibilityService } from "@src/gpu-waitlist/services/gpu-waitlist-eligibility/gpu-waitlist-eligibility.service";
import { GpuWaitlistNetworkService } from "@src/gpu-waitlist/services/gpu-waitlist-network/gpu-waitlist-network.service";
import { GpuWaveService } from "@src/gpu-waitlist/services/gpu-wave/gpu-wave.service";
import { ConfirmGpuPools } from "./confirm-gpu-pools.job";

type PoolToCheck = { poolKey: string; rows: GpuSupplyRow[]; kind: PoolKind; supply: PoolSupply; smallestGpuCount: number; setup: GpuSetup };

@singleton()
export class ConfirmGpuPoolsHandler implements JobHandler<ConfirmGpuPools> {
  public readonly accepts = ConfirmGpuPools;

  /** One check deployment at a time; the watcher keeps a pool it could not hand over due for its next run. */
  public readonly policy = "exclusive";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly gpuWaitlistNetworkService: GpuWaitlistNetworkService,
    private readonly gpuWaitlistEligibilityService: GpuWaitlistEligibilityService,
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
    if (!this.gpuWaitlistNetworkService.servesGpuWaitlists()) return;
    if (!this.featureFlagsService.isEnabled(FeatureFlags.GPU_AVAILABILITY_ALERTS, {})) return;

    const now = new Date();
    const prepared: PoolToCheck[] = [];
    const unanswered: string[] = [];
    const rowsByKey = new Map((await this.gpuWaitlistPoolRepository.findByPoolKeys(poolKeys)).map(row => [row.poolKey, row]));

    for (const poolKey of poolKeys) {
      try {
        const pool = await this.#prepare(poolKey, rowsByKey.get(poolKey), now);
        if (pool) prepared.push(pool);
      } catch (error) {
        this.#logger.error({ event: "GPU_WAITLIST_CONFIRM_FAILED", poolKey, error });
        unanswered.push(poolKey);
      }
    }

    const pools = await this.#claim(prepared, now);
    const results = await this.#check(pools);

    if (!results) {
      unanswered.push(...pools.map(pool => pool.poolKey));
    } else {
      for (const [index, pool] of pools.entries()) {
        try {
          await this.#startWaveOnLiveBid(pool, results[index]);
        } catch (error) {
          this.#logger.error({ event: "GPU_WAITLIST_CONFIRM_FAILED", poolKey: pool.poolKey, error });
          unanswered.push(pool.poolKey);
        }
      }
    }

    await this.#giveRisesBack(unanswered);
  }

  /** The watcher consumed the rise that handed these pools over, so a pool this run could not answer for gets it back and is handed over again after the cooldown. */
  async #giveRisesBack(poolKeys: string[]): Promise<void> {
    if (!poolKeys.length) return;

    try {
      await this.gpuWaitlistPoolRepository.resetFreeUnits(poolKeys);
      this.#logger.info({ event: "GPU_WAITLIST_CONFIRM_RISE_KEPT", poolKeys });
    } catch (error) {
      this.#logger.error({ event: "GPU_WAITLIST_CONFIRM_RISE_KEEP_FAILED", poolKeys, error });
    }
  }

  async #prepare(poolKey: string, row: GpuWaitlistPoolRow | undefined, now: Date): Promise<PoolToCheck | undefined> {
    const entries = await this.gpuWaitlistEntryRepository.findWaitingInPoolAcrossOrganizations(poolKey);
    if (!entries.length) return undefined;

    const [{ vendor, model, memory, interface: gpuInterface }] = entries;
    const kind = { memory, interface: gpuInterface };
    const [rows, bidders] = await Promise.all([
      this.gpuSupplyHttpService.findSupply({ vendor, model }),
      this.gpuBidCheckRepository.findProvidersWithBidsSince({ vendor, model, since: subDays(now, this.config.GPU_WAITLIST_BID_EVIDENCE_DAYS) })
    ]);
    const supply = summarizePoolSupply(rows, new Set(bidders), kind);
    const largestFreeNode = Math.max(0, ...supply.nodeFreeUnits);
    const fitting = entries.filter(entry => entry.gpuCount <= largestFreeNode);

    if (!fitting.length) {
      this.#logger.info({ event: "GPU_WAITLIST_CONFIRM_NO_FIT", poolKey });
      return undefined;
    }

    const firstEligible = await this.gpuWaitlistEligibilityService.findFirstEligible(fitting, row, now);

    if (!firstEligible) {
      this.#logger.info({ event: "GPU_WAITLIST_CONFIRM_NO_ELIGIBLE_FIT", poolKey });
      return undefined;
    }

    return {
      poolKey,
      rows,
      kind,
      supply,
      smallestGpuCount: Math.min(...entries.map(entry => entry.gpuCount)),
      setup: { vendor: "nvidia", model, memory: memory ?? undefined, interface: toGpuSetupInterface(gpuInterface), count: firstEligible.gpuCount }
    };
  }

  /** Claiming marks the pools checked before the check runs, so neither a failing check nor a retried job can spend another check inside the cooldown. */
  async #claim(prepared: PoolToCheck[], now: Date): Promise<PoolToCheck[]> {
    if (!prepared.length) return [];

    const poolKeys = prepared.map(pool => pool.poolKey);
    const claimed = new Set(
      await this.gpuWaitlistPoolRepository.claimForCheck({
        poolKeys,
        checkedAt: now,
        cooledDownBefore: subMinutes(now, this.config.GPU_WAITLIST_CHECK_COOLDOWN_MINUTES)
      })
    );

    if (!claimed.size) this.#logger.info({ event: "GPU_WAITLIST_CONFIRM_NOTHING_CLAIMED", poolKeys });

    return prepared.filter(pool => claimed.has(pool.poolKey));
  }

  async #check(pools: PoolToCheck[]): Promise<GpuSetupResult[] | undefined> {
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

      return outcome.results;
    } catch (error) {
      this.#logger.error({ event: "GPU_WAITLIST_CHECK_FAILED", poolKeys, error });
      return undefined;
    }
  }

  async #startWaveOnLiveBid(pool: PoolToCheck, { status, bids }: GpuSetupResult): Promise<void> {
    const { poolKey } = pool;

    if (status === "invalid") {
      this.#logger.warn({ event: "GPU_WAITLIST_CONFIRM_SETUP_INVALID", poolKey, setup: pool.setup });
      return;
    }

    const liveBids = bids.filter(bid => pool.supply.providers.includes(bid.provider));
    const liveSupply = summarizePoolSupply(pool.rows, new Set(liveBids.map(bid => bid.provider)), pool.kind);

    if (Math.max(0, ...liveSupply.nodeFreeUnits) < pool.smallestGpuCount) {
      await this.gpuWaitlistPoolRepository.update(poolKey, { waveStartedAt: null });
      this.#logger.info({ event: "GPU_WAITLIST_CONFIRM_NO_LIVE_BID", poolKey });
      return;
    }

    const priceUsdPerHour = Math.min(...liveBids.map(bid => bid.priceUsdPerHour));
    const pricePerGpuUsdPerHour = priceUsdPerHour / pool.setup.count;
    await this.gpuWaitlistPoolRepository.update(poolKey, { lastCheckPriceUsdPerHour: priceUsdPerHour });
    const recipients = await this.gpuWaveService.startWave(poolKey, { nodeFreeUnits: liveSupply.nodeFreeUnits }, pricePerGpuUsdPerHour);

    this.#logger.info({ event: "GPU_WAITLIST_CONFIRM_WAVE_STARTED", poolKey, priceUsdPerHour, pricePerGpuUsdPerHour, recipientCount: recipients.length });
  }
}
