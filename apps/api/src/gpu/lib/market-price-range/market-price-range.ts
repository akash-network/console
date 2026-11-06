import { round } from "@src/utils/math";

export interface PriceSample {
  provider: string;
  usdPerGpuHour: number;
  observedAt: Date;
}

export interface MarketPriceThresholds {
  minProviders: number;
  minSamples: number;
}

export interface MarketPriceRange {
  lowUsdPerGpuHour: number | null;
  medianUsdPerGpuHour: number | null;
  highUsdPerGpuHour: number | null;
  sampleCount: number;
  providerCount: number;
  newestSampleAt: Date;
}

const LOW_PERCENTILE = 0.1;
const HIGH_PERCENTILE = 0.9;

/** The range is p10, median and p90 so one outlier bid can't set it; below either threshold it keeps the counts but no prices. */
export function summarizePriceSamples(samples: PriceSample[], thresholds: MarketPriceThresholds): MarketPriceRange | null {
  if (!samples.length) return null;

  const prices = samples.map(sample => sample.usdPerGpuHour).sort((a, b) => a - b);
  const providerCount = new Set(samples.map(sample => sample.provider)).size;
  const newestSampleAt = new Date(Math.max(...samples.map(sample => sample.observedAt.getTime())));
  const hasEnoughData = providerCount >= thresholds.minProviders && samples.length >= thresholds.minSamples;

  return {
    lowUsdPerGpuHour: hasEnoughData ? round(percentile(prices, LOW_PERCENTILE)) : null,
    medianUsdPerGpuHour: hasEnoughData ? round(percentile(prices, 0.5)) : null,
    highUsdPerGpuHour: hasEnoughData ? round(percentile(prices, HIGH_PERCENTILE)) : null,
    sampleCount: samples.length,
    providerCount,
    newestSampleAt
  };
}

function percentile(sortedValues: number[], fraction: number): number {
  const position = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (position - lower);
}
