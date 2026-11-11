import type { RegionArea } from "@src/gpu/lib/region-area/region-area";
import type { GpuMarketPriceSource } from "@src/gpu/model-schemas";
import type { RequestedHardware } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";

export interface UnmetDemandSummary {
  vendor: string | null;
  model: string | null;
  regionArea: RegionArea | null;
  noFit: number;
  missingGpu: number;
  zeroBid: number;
  gpusAsked: number;
}

export interface GpuVariantSupply {
  vendor: string;
  model: string;
  allocatable: number;
  available: number;
  providers: Array<{ owner: string; area: RegionArea | null }>;
}

export interface MarketPrice {
  vendor: string;
  model: string;
  area: RegionArea | null;
  source: GpuMarketPriceSource;
  medianUsdPerGpuHour: number | null;
  sampleCount: number;
}

export type MedianBySource = Record<GpuMarketPriceSource, number | null>;

export interface UnmetDemandReportRow extends UnmetDemandSummary {
  totalUnmet: number;
  hardwareRequests: number | null;
  supply: { allocatable: number; available: number; biddingProviders: number; biddingProvidersInArea: number | null } | null;
  marketMedianUsdPerGpuHour: { allRegions: MedianBySource; area: MedianBySource | null } | null;
}

/** A row open to any model has no single model to compare, so it carries no requests, supply or price. */
export function buildUnmetDemandReport(input: {
  summaries: UnmetDemandSummary[];
  hardwareRequests: RequestedHardware[];
  supply: GpuVariantSupply[] | null;
  marketPrices: MarketPrice[];
}): UnmetDemandReportRow[] {
  return input.summaries
    .map(summary => ({
      ...summary,
      totalUnmet: summary.noFit + summary.missingGpu + summary.zeroBid,
      hardwareRequests: summary.model ? countHardwareRequests(input.hardwareRequests, summary) : null,
      supply: summary.model && input.supply ? summarizeSupply(input.supply, summary) : null,
      marketMedianUsdPerGpuHour: summary.model ? findMarketMedians(input.marketPrices, summary) : null
    }))
    .sort((a, b) => b.totalUnmet - a.totalUnmet || b.gpusAsked - a.gpusAsked || orderKey(a).localeCompare(orderKey(b)));
}

/** Requests name models in free text, so "NVIDIA H100" and "h-100" both count toward nvidia/h100. */
function countHardwareRequests(requests: RequestedHardware[], { vendor, model, regionArea }: UnmetDemandSummary): number {
  const names = new Set([compact(model), compact(`${vendor ?? ""}${model}`)]);
  return requests.filter(request => names.has(compact(request.model)) && admitsArea(request.region, regionArea)).length;
}

/** A request with no region, or one open to any, fits every area. */
function admitsArea(region: RequestedHardware["region"], area: RegionArea | null): boolean {
  if (!area || !region || region.mode === "any") return true;
  return region.mode === "only" ? region.areas.includes(area) : !region.areas.includes(area);
}

function summarizeSupply(supply: GpuVariantSupply[], summary: UnmetDemandSummary): NonNullable<UnmetDemandReportRow["supply"]> {
  const variants = supply.filter(variant => matchesModel(variant, summary));
  const providers = variants.flatMap(variant => variant.providers);

  return {
    allocatable: variants.reduce((total, variant) => total + variant.allocatable, 0),
    available: variants.reduce((total, variant) => total + variant.available, 0),
    biddingProviders: new Set(providers.map(({ owner }) => owner)).size,
    biddingProvidersInArea: summary.regionArea ? new Set(providers.filter(({ area }) => area === summary.regionArea).map(({ owner }) => owner)).size : null
  };
}

function findMarketMedians(prices: MarketPrice[], summary: UnmetDemandSummary): NonNullable<UnmetDemandReportRow["marketMedianUsdPerGpuHour"]> {
  const modelPrices = prices.filter(price => matchesModel(price, summary));

  return {
    allRegions: findMediansIn(modelPrices, null),
    area: summary.regionArea ? findMediansIn(modelPrices, summary.regionArea) : null
  };
}

/** A model priced in several ram or interface variants shows the median of its most sampled one. */
function findMediansIn(prices: MarketPrice[], area: RegionArea | null): MedianBySource {
  const inArea = prices.filter(price => price.area === area);
  const medianOf = (source: GpuMarketPriceSource) =>
    inArea
      .filter(price => price.source === source)
      .reduce<MarketPrice | null>((best, price) => (!best || price.sampleCount > best.sampleCount ? price : best), null)?.medianUsdPerGpuHour ?? null;

  return { bid: medianOf("bid"), lease: medianOf("lease") };
}

function matchesModel(gpu: { vendor: string; model: string }, { vendor, model }: UnmetDemandSummary): boolean {
  return (!vendor || gpu.vendor.toLowerCase() === vendor) && gpu.model.toLowerCase() === model;
}

function compact(name: string | null): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function orderKey({ vendor, model, regionArea }: UnmetDemandSummary): string {
  return [vendor ?? "", model ?? "", regionArea ?? ""].join("/");
}
