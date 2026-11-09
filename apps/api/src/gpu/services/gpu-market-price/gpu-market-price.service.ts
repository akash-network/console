import { subHours } from "date-fns";
import { chunk } from "lodash";
import { inject, singleton } from "tsyringe";

import type { Registry } from "@src/billing/providers/type-registry.provider";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { type GpuLeasePrice, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import type { GpuConfig } from "@src/gpu/config/env.config";
import { blockPriceToUsd } from "@src/gpu/lib/block-price/block-price";
import { type BidGpu, decodeGpuBid, type GpuBidMessage } from "@src/gpu/lib/gpu-bid-decoder/gpu-bid-decoder";
import { type PriceSample, summarizePriceSamples } from "@src/gpu/lib/market-price-range/market-price-range";
import { type RegionArea, toRegionArea } from "@src/gpu/lib/region-area/region-area";
import type { GpuMarketPriceSource } from "@src/gpu/model-schemas";
import { GPU_CONFIG } from "@src/gpu/providers/config.provider";
import { DayRepository } from "@src/gpu/repositories/day.repository";
import { type GpuMarketPriceInsert, GpuMarketPriceRepository } from "@src/gpu/repositories/gpu-market-price/gpu-market-price.repository";
import { PRICING_BOT_CPU_UNITS } from "@src/gpu/services/gpu-price/gpu-price.service";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";

const LEASE_LOOKUP_CHUNK_SIZE = 1000;
const HOURS_PER_DAY = 24;
/** Day rows are dated at midnight, so the AKT price of the window's first day starts before the window does. */
const AKT_PRICE_LOOKBACK_DAYS = 2;

export interface GpuVariant {
  vendor: string;
  model: string;
  ram: string | null;
  interface: string | null;
}

interface PricedBid extends PriceSample {
  variant: GpuVariant;
  gseq: number;
  oseq: number;
  isPricingBotOrder: boolean;
}

interface VariantSample extends PriceSample {
  variant: GpuVariant;
  source: GpuMarketPriceSource;
}

interface DeploymentBids {
  owner: string;
  bids: PricedBid[];
}

@singleton()
export class GpuMarketPriceService {
  readonly #config: GpuConfig;
  readonly #typeRegistry: Registry;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    private readonly leaseRepository: LeaseRepository,
    private readonly providerRepository: ProviderRepository,
    private readonly akashBlockRepository: AkashBlockRepository,
    private readonly dayRepository: DayRepository,
    private readonly gpuMarketPriceRepository: GpuMarketPriceRepository,
    @inject(GPU_CONFIG) config: GpuConfig,
    @inject(TYPE_REGISTRY) typeRegistry: Registry,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#config = config;
    this.#typeRegistry = typeRegistry;
    this.#logger = createLogger({ context: GpuMarketPriceService.name });
  }

  /** Recomputes every range from the window's bids and leases and swaps them in; a dry run computes without writing. */
  async refresh({ dryRun = false, now = new Date() }: { dryRun?: boolean; now?: Date } = {}): Promise<{ rowCount: number }> {
    const windowStart = subHours(now, HOURS_PER_DAY * this.#config.GPU_MARKET_PRICE_WINDOW_DAYS);
    const firstBlock = await this.akashBlockRepository.getFirstBlockAfter(windowStart);
    if (!firstBlock) throw new Error("No block found in the market price window");

    const days = await this.dayRepository.getDaysAfter(subHours(windowStart, HOURS_PER_DAY * AKT_PRICE_LOOKBACK_DAYS));
    const aktPriceByDayId = new Map(days.map(day => [day.id, day.aktPrice]));

    const bidsByDeploymentId = await this.#collectBids(firstBlock.height, aktPriceByDayId);
    const leaseSamples = await this.#collectLeaseSamples(bidsByDeploymentId, aktPriceByDayId);
    const bidSamples = toDailyLowestBids([...bidsByDeploymentId.values()].flatMap(({ bids }) => bids));
    const samples = [...bidSamples, ...leaseSamples];

    const regions = await this.providerRepository.findLocationRegions([...new Set(samples.map(sample => sample.provider))]);
    const rows = this.#toRows(samples, provider => toRegionArea(regions.get(provider)), now);

    if (!dryRun) await this.gpuMarketPriceRepository.replaceAll(rows);
    this.#logger.info({
      event: "GPU_MARKET_PRICES_REFRESHED",
      dryRun,
      rowCount: rows.length,
      bidSamples: bidSamples.length,
      leaseSamples: leaseSamples.length,
      ...(dryRun && { rows })
    });

    return { rowCount: rows.length };
  }

  async #collectBids(minHeight: number, aktPriceByDayId: Map<string, number | null | undefined>): Promise<Map<string, DeploymentBids>> {
    const bidsByDeploymentId = new Map<string, DeploymentBids>();

    for await (const deployment of this.deploymentRepository.findAllWithGpuResources({ minHeight })) {
      const isPricingBotDeployment = deployment.owner === this.#config.PRICING_BOT_ADDRESS;
      const bids = deployment.relatedMessages.flatMap(message => {
        const bid = this.#toPricedBid(message, aktPriceByDayId.get(message.block.dayId), isPricingBotDeployment);
        return bid ? [bid] : [];
      });
      bidsByDeploymentId.set(deployment.id, { owner: deployment.owner, bids });
    }

    return bidsByDeploymentId;
  }

  /** Keeps single-model gpu bids that convert to USD; the pricing bot's bids count only on its tiny pricing order, whose price is the gpu's alone. */
  #toPricedBid(message: GpuBidMessage & { block: { datetime: Date } }, aktPrice: number | null | undefined, isPricingBotDeployment: boolean): PricedBid | null {
    const bid = decodeGpuBid(this.#typeRegistry, message);
    const [gpu, ...otherGpus] = bid.gpus;
    if (!gpu || otherGpus.length) return null;
    if (isPricingBotDeployment && bid.cpuUnits !== PRICING_BOT_CPU_UNITS) return null;

    const variant = toVariant(gpu);
    const hourlyUsd = blockPriceToUsd(bid, aktPrice, "hour");
    if (!variant || hourlyUsd === null) return null;

    return {
      provider: bid.provider,
      usdPerGpuHour: hourlyUsd / bid.gpuUnits,
      observedAt: message.block.datetime,
      variant,
      gseq: bid.gseq,
      oseq: bid.oseq,
      isPricingBotOrder: isPricingBotDeployment
    };
  }

  /** A lease takes its gpu model from the bid it accepted, because the group may have asked for any model. */
  async #collectLeaseSamples(
    bidsByDeploymentId: Map<string, DeploymentBids>,
    aktPriceByDayId: Map<string, number | null | undefined>
  ): Promise<VariantSample[]> {
    const tenantDeploymentIds = [...bidsByDeploymentId].flatMap(([deploymentId, { owner }]) =>
      owner === this.#config.PRICING_BOT_ADDRESS ? [] : [deploymentId]
    );
    const samples: VariantSample[] = [];

    for (const deploymentIds of chunk(tenantDeploymentIds, LEASE_LOOKUP_CHUNK_SIZE)) {
      const leases = await this.leaseRepository.findGpuLeasePricesOfDeployments(deploymentIds);
      for (const lease of leases) {
        const sample = toLeaseSample(lease, bidsByDeploymentId.get(lease.deploymentId)?.bids ?? [], aktPriceByDayId.get(lease.dayId));
        if (sample) samples.push(sample);
      }
    }

    return samples;
  }

  #toRows(samples: VariantSample[], areaOf: (provider: string) => RegionArea | null, computedAt: Date): GpuMarketPriceInsert[] {
    const thresholds = { minProviders: this.#config.GPU_MARKET_PRICE_MIN_PROVIDERS, minSamples: this.#config.GPU_MARKET_PRICE_MIN_SAMPLES };
    const groups = Map.groupBy(samples, sample => `${variantKey(sample.variant)}|${sample.source}`);

    return [...groups.values()].flatMap(group => {
      const { variant, source } = group[0];
      const byArea = Map.groupBy(group, sample => areaOf(sample.provider));
      const scopes: [RegionArea | null, VariantSample[]][] = [[null, group], ...[...byArea].filter(([area]) => area !== null)];

      return scopes.flatMap(([area, scopedSamples]) => {
        const range = summarizePriceSamples(scopedSamples, thresholds);
        return range ? [{ ...variant, area, source, ...range, windowDays: this.#config.GPU_MARKET_PRICE_WINDOW_DAYS, computedAt }] : [];
      });
    });
  }
}

function toVariant(gpu: BidGpu): GpuVariant | null {
  if (!gpu.vendor || !gpu.model) return null;
  return { vendor: gpu.vendor, model: gpu.model, ram: gpu.ram ?? null, interface: gpu.interface ?? null };
}

function variantKey({ vendor, model, ram, interface: gpuInterface }: GpuVariant): string {
  return [vendor, model, ram, gpuInterface].join("|");
}

function toLeaseSample(lease: GpuLeasePrice, deploymentBids: PricedBid[], aktPrice: number | null | undefined): VariantSample | null {
  const acceptedBid = deploymentBids.find(bid => bid.provider === lease.providerAddress && bid.gseq === lease.gseq && bid.oseq === lease.oseq);
  const hourlyUsd = blockPriceToUsd({ denom: lease.denom, amountPerBlock: lease.price }, aktPrice, "hour");
  if (!acceptedBid || hourlyUsd === null) return null;

  return {
    provider: lease.providerAddress,
    usdPerGpuHour: hourlyUsd / lease.gpuUnits,
    observedAt: lease.createdAt,
    variant: acceptedBid.variant,
    source: "lease"
  };
}

/** One sample per provider, model and UTC day, so a provider the pricing bot checks every hour weighs no more than one bidding daily; the bot's own price wins its day. */
function toDailyLowestBids(bids: PricedBid[]): VariantSample[] {
  const byProviderDay = Map.groupBy(bids, bid => `${bid.provider}|${variantKey(bid.variant)}|${bid.observedAt.toISOString().slice(0, 10)}`);

  return [...byProviderDay.values()].map(dayBids => {
    const pricingBotBids = dayBids.filter(bid => bid.isPricingBotOrder);
    const candidates = pricingBotBids.length ? pricingBotBids : dayBids;
    const lowest = candidates.reduce((best, bid) => (bid.usdPerGpuHour < best.usdPerGpuHour ? bid : best));

    return { provider: lowest.provider, usdPerGpuHour: lowest.usdPerGpuHour, observedAt: lowest.observedAt, variant: lowest.variant, source: "bid" };
  });
}
