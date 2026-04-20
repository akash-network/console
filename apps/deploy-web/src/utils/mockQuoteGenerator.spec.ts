import { describe, expect, it } from "vitest";

import { generateMockQuote } from "./mockQuoteGenerator";

describe("generateMockQuote", () => {
  it("generates a quote for a basic CPU workload", () => {
    const result = setup();

    expect(result.pricePerBlock).toBeCloseTo(0.0085, 4);
    expect(result.monthlyCostUsd).toBeGreaterThan(0);
    expect(result.breakdown.cpu.pricePerBlock).toBeCloseTo(0.006, 4);
    expect(result.breakdown.cpu.monthlyCostUsd).toBeGreaterThan(0);
    expect(result.breakdown.memory.pricePerBlock).toBeCloseTo(0.002, 4);
    expect(result.breakdown.ephemeral.pricePerBlock).toBeCloseTo(0.0005, 4);
    expect(result.expiresIn).toBe(120);
  });

  it("includes GPU cost when gpu > 0", () => {
    const result = setup({
      resources: [{ cpu: 4000, memory: 34359738368, gpu: 2, ephemeralStorage: 107374182400, count: 1 }]
    });

    expect(result.breakdown.gpu?.pricePerBlock).toBeCloseTo(0.2, 4);
    expect(result.pricePerBlock).toBeGreaterThan(0.2);
  });

  it("includes persistent storage cost", () => {
    const result = setup({
      resources: [{ cpu: 1000, memory: 1073741824, gpu: 0, ephemeralStorage: 1073741824, persistentStorage: 10737418240, count: 1 }]
    });

    expect(result.breakdown.persistentStorage?.pricePerBlock).toBeCloseTo(0.005, 4);
  });

  function setup(input: { resources?: any[]; actUsdPrice?: number } = {}) {
    const resources = input.resources ?? [{ cpu: 500, memory: 536870912, gpu: 0, ephemeralStorage: 1073741824, count: 1 }];
    const actUsdPrice = input.actUsdPrice ?? 0.35;
    return generateMockQuote(resources, actUsdPrice);
  }
});
