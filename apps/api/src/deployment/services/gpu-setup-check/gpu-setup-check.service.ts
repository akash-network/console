import { generateManifest } from "@akashnetwork/chain-sdk";
import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { BadRequest } from "http-errors";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { DEPLOYMENT_CONFIG, type DeploymentConfig } from "@src/deployment/config/config.provider";
import { type GpuBidCheckInsert, GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { GpuSetupCheckRunRepository } from "@src/deployment/repositories/gpu-setup-check-run/gpu-setup-check-run.repository";
import { buildGpuCheckSdl, SDL_GPU_ATTRIBUTE_VALUE } from "@src/deployment/services/gpu-bids-creator/gpu-check-sdl";
import { type GpuCheckManifest, GpuCheckRunner, type GpuCheckRunResult } from "@src/deployment/services/gpu-check-runner/gpu-check-runner.service";
import { blockPriceToUsd } from "@src/gpu/lib/block-price/block-price";
import { DayRepository } from "@src/gpu/repositories/day.repository";

/** The chain refuses a deployment with more placement groups than this. */
export const MAX_GPU_SETUPS_PER_CHECK = 20;

export interface GpuSetup {
  vendor: "nvidia";
  model: string;
  memory?: string;
  interface?: string;
  count: number;
}

export interface GpuSetupBid {
  provider: string;
  priceUsdPerHour: number;
}

/** An invalid setup is left out of the check deployment, so it has no bids. */
export interface GpuSetupResult {
  setup: GpuSetup;
  status: "checked" | "invalid";
  bids: GpuSetupBid[];
}

export type GpuSetupCheckOutcome = { status: "checked"; results: GpuSetupResult[] } | { status: "cap_reached" } | { status: "unavailable" };

@singleton()
export class GpuSetupCheckService {
  readonly #deploymentConfig: DeploymentConfig;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuCheckRunner: GpuCheckRunner,
    private readonly gpuSetupCheckRunRepository: GpuSetupCheckRunRepository,
    private readonly gpuBidCheckRepository: GpuBidCheckRepository,
    private readonly dayRepository: DayRepository,
    @inject(DEPLOYMENT_CONFIG) deploymentConfig: DeploymentConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#deploymentConfig = deploymentConfig;
    this.#logger = createLogger({ context: GpuSetupCheckService.name });
  }

  async check(setups: GpuSetup[]): Promise<GpuSetupCheckOutcome> {
    if (setups.length > MAX_GPU_SETUPS_PER_CHECK) {
      throw new BadRequest(`At most ${MAX_GPU_SETUPS_PER_CHECK} gpu setups can be checked at once`);
    }

    const planned = setups.map(setup => ({ setup, isValid: this.#isValid(setup) }));
    const checkable = planned.filter(({ isValid }) => isValid);
    if (checkable.length === 0) return { status: "checked", results: setups.map(setup => ({ setup, status: "invalid", bids: [] })) };

    const runsToday = await this.gpuSetupCheckRunRepository.countCreatedSince(startOfUtcDay(new Date()));
    if (runsToday >= this.#deploymentConfig.GPU_SETUP_CHECK_DAILY_CAP) return { status: "cap_reached" };

    const session = await this.gpuCheckRunner.connect();
    if (!session) return { status: "unavailable" };

    const checkableSetups = checkable.map(({ setup }) => setup);
    const [runResult] = await this.gpuCheckRunner.run(session, [{ manifest: buildManifest(checkableSetups) }]);
    const checkedAt = new Date();

    await this.gpuSetupCheckRunRepository.insert({ dseq: runResult.dseq, setupCount: checkableSetups.length });
    await this.gpuBidCheckRepository.insertMany(checkableSetups.flatMap((setup, index) => toCheckRows(setup, index, runResult, checkedAt)));

    const aktPrice = await this.dayRepository.getLatestAktPrice();
    const results = planned.map((plan): GpuSetupResult => {
      if (!plan.isValid) return { setup: plan.setup, status: "invalid", bids: [] };

      return { setup: plan.setup, status: "checked", bids: toSetupBids(bidsOfGroup(runResult.bids, checkable.indexOf(plan)), aktPrice) };
    });
    this.#logger.info({
      event: "GPU_SETUP_CHECK_COMPLETED",
      dseq: runResult.dseq,
      setupCount: checkableSetups.length,
      bidderCount: results.flatMap(({ bids }) => bids).length
    });

    return { status: "checked", results };
  }

  /** Setups come from what users asked to wait for, so one that cannot be deployed is dropped on its own rather than failing the check of every other. */
  #isValid(setup: GpuSetup): boolean {
    const reason = findInvalidReason(setup);
    if (reason) this.#logger.warn({ event: "GPU_SETUP_CHECK_SETUP_INVALID", setup, reason });

    return !reason;
  }
}

function findInvalidReason(setup: GpuSetup): string | undefined {
  if (!SDL_GPU_ATTRIBUTE_VALUE.test(setup.model) || (setup.memory && !SDL_GPU_ATTRIBUTE_VALUE.test(setup.memory))) {
    return "The model or memory cannot be written into an SDL attribute";
  }

  const manifest = generateManifest(buildSdl([setup]));
  if (!manifest.ok) return manifest.value.map(error => error.message).join(", ");

  return undefined;
}

function startOfUtcDay(date: Date): Date {
  const utcMidnight = new Date(date);
  utcMidnight.setUTCHours(0, 0, 0, 0);
  return utcMidnight;
}

function buildSdl(setups: GpuSetup[]) {
  return buildGpuCheckSdl(
    setups.map(({ model, memory, interface: gpuInterface, count }) => ({ model, memory, interface: gpuInterface, units: count, shape: "typical" }))
  );
}

function buildManifest(setups: GpuSetup[]): GpuCheckManifest {
  const manifest = generateManifest(buildSdl(setups));

  if (!manifest.ok) {
    throw new BadRequest(`Invalid gpu setup: ${manifest.value.map(error => error.message).join(", ")}`);
  }

  const { groups, groupSpecs } = manifest.value;
  return { groups, groupSpecs, groupModels: setups.map(({ model }) => model) };
}

function bidsOfGroup(bids: Bid[], groupIndex: number): Bid[] {
  return bids.filter(({ id }) => id?.gseq === groupIndex + 1);
}

function toSetupBids(bids: Bid[], aktPrice: number | null): GpuSetupBid[] {
  const cheapestByProvider = new Map<string, number>();

  for (const { id, price } of bids) {
    const priceUsdPerHour = blockPriceToUsd({ denom: price?.denom, amountPerBlock: parseFloat(price?.amount ?? "") }, aktPrice, "hour");
    if (!id || priceUsdPerHour === null || Number.isNaN(priceUsdPerHour)) continue;
    cheapestByProvider.set(id.provider, Math.min(priceUsdPerHour, cheapestByProvider.get(id.provider) ?? Infinity));
  }

  return [...cheapestByProvider].map(([provider, priceUsdPerHour]) => ({ provider, priceUsdPerHour })).sort((a, b) => a.priceUsdPerHour - b.priceUsdPerHour);
}

function toCheckRows(
  { vendor, model }: GpuSetup,
  groupIndex: number,
  { dseq, bids, screenedByGroup }: GpuCheckRunResult,
  checkedAt: Date
): GpuBidCheckInsert[] {
  const screened = screenedByGroup && new Set(screenedByGroup[groupIndex]);
  const bidders = new Set(bidsOfGroup(bids, groupIndex).flatMap(({ id }) => (id ? [id.provider] : [])));
  const providers = new Set([...(screened ?? []), ...bidders]);

  return [...providers].map(provider => ({
    provider,
    vendor,
    model,
    source: "setup-check",
    dseq,
    screened: screened?.has(provider) ?? false,
    bid: bidders.has(provider),
    checkedAt
  }));
}
