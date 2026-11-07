import { describe, expect, it } from "vitest";

import { type PriceSample, summarizePriceSamples } from "./market-price-range";

const THRESHOLDS = { minProviders: 3, minSamples: 5 };

describe(summarizePriceSamples.name, () => {
  it("returns p10, median and p90 with the sample and provider counts", () => {
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((price, index) => aSample({ provider: `p${index % 4}`, usdPerGpuHour: price }));

    expect(summarizePriceSamples(samples, THRESHOLDS)).toMatchObject({
      lowUsdPerGpuHour: 2,
      medianUsdPerGpuHour: 6,
      highUsdPerGpuHour: 10,
      sampleCount: 11,
      providerCount: 4
    });
  });

  it("interpolates between neighbouring prices and rounds to cents", () => {
    const samples = [1, 2, 3, 4, 5.555].map((price, index) => aSample({ provider: `p${index}`, usdPerGpuHour: price }));

    expect(summarizePriceSamples(samples, THRESHOLDS)).toMatchObject({ lowUsdPerGpuHour: 1.4, medianUsdPerGpuHour: 3, highUsdPerGpuHour: 4.93 });
  });

  it("sorts samples before reading percentiles", () => {
    const samples = [9, 1, 5, 3, 7].map((price, index) => aSample({ provider: `p${index}`, usdPerGpuHour: price }));

    expect(summarizePriceSamples(samples, THRESHOLDS)).toMatchObject({ lowUsdPerGpuHour: 1.8, medianUsdPerGpuHour: 5, highUsdPerGpuHour: 8.2 });
  });

  it("reports the newest sample time", () => {
    const samples = [
      aSample({ provider: "a", observedAt: new Date("2026-11-01T00:00:00Z") }),
      aSample({ provider: "b", observedAt: new Date("2026-11-04T12:00:00Z") }),
      aSample({ provider: "c", observedAt: new Date("2026-11-02T00:00:00Z") })
    ];

    expect(summarizePriceSamples(samples, THRESHOLDS)?.newestSampleAt).toEqual(new Date("2026-11-04T12:00:00Z"));
  });

  it("keeps the counts but gives no prices when too few providers back the samples", () => {
    const samples = [1, 2, 3, 4, 5, 6].map(price => aSample({ provider: price % 2 ? "a" : "b", usdPerGpuHour: price }));

    expect(summarizePriceSamples(samples, THRESHOLDS)).toMatchObject({
      lowUsdPerGpuHour: null,
      medianUsdPerGpuHour: null,
      highUsdPerGpuHour: null,
      sampleCount: 6,
      providerCount: 2
    });
  });

  it("gives no prices when there are too few samples", () => {
    const samples = [1, 2, 3, 4].map((price, index) => aSample({ provider: `p${index}`, usdPerGpuHour: price }));

    expect(summarizePriceSamples(samples, THRESHOLDS)).toMatchObject({ medianUsdPerGpuHour: null, sampleCount: 4, providerCount: 4 });
  });

  it("gives prices once both thresholds are met exactly", () => {
    const samples = [1, 2, 3, 4, 5].map((price, index) => aSample({ provider: `p${index % 3}`, usdPerGpuHour: price }));

    expect(summarizePriceSamples(samples, THRESHOLDS)?.medianUsdPerGpuHour).toBe(3);
  });

  it("returns null without samples", () => {
    expect(summarizePriceSamples([], THRESHOLDS)).toBeNull();
  });

  function aSample(overrides: Partial<PriceSample>): PriceSample {
    return { provider: "akash1provider", usdPerGpuHour: 1, observedAt: new Date("2026-11-01T00:00:00Z"), ...overrides };
  }
});
