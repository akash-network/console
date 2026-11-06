import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import type { GpuMarketPricesResponse } from "@src/gpu/http-schemas/gpu-market.schema";
import { type GpuMarketPriceInsert, GpuMarketPriceRepository } from "@src/gpu/repositories/gpu-market-price/gpu-market-price.repository";
import { app } from "@src/rest-app";

describe("Internal gpu market routes", () => {
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;

  describe("GET /internal/gpu-market-prices", () => {
    it("rejects a caller with no token", async () => {
      const response = await get("/internal/gpu-market-prices", { token: undefined });

      expect(response.status).toBe(401);
    });

    it("rejects a caller with the wrong token", async () => {
      const response = await get("/internal/gpu-market-prices", { token: faker.string.alphanumeric(32) });

      expect(response.status).toBe(401);
    });

    it("returns the stored ranges, including those too thin to price", async () => {
      await seedPrices([
        aRow({ model: "h100", area: null, source: "lease", sampleCount: 23, providerCount: 6 }),
        aRow({ model: "h100", area: "apac", lowUsdPerGpuHour: null, medianUsdPerGpuHour: null, highUsdPerGpuHour: null, sampleCount: 2, providerCount: 1 })
      ]);

      const response = await get("/internal/gpu-market-prices");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [
          {
            vendor: "nvidia",
            model: "h100",
            ram: "80Gi",
            interface: "sxm",
            area: "apac",
            source: "bid",
            lowUsdPerGpuHour: null,
            medianUsdPerGpuHour: null,
            highUsdPerGpuHour: null,
            sampleCount: 2,
            providerCount: 1,
            newestSampleAt: "2026-11-05T00:00:00.000Z",
            windowDays: 30,
            computedAt: "2026-11-06T03:37:00.000Z"
          },
          expect.objectContaining({ area: null, source: "lease", medianUsdPerGpuHour: 2, sampleCount: 23, providerCount: 6 })
        ]
      } satisfies GpuMarketPricesResponse);
    });

    it("filters by vendor and model regardless of case", async () => {
      await seedPrices([aRow({ model: "h100" }), aRow({ model: "a100" }), aRow({ vendor: "amd", model: "mi300x" })]);

      const response = await get("/internal/gpu-market-prices?vendor=NVIDIA&model=A100");

      const body = (await response.json()) as GpuMarketPricesResponse;
      expect(body.data.map(row => row.model)).toEqual(["a100"]);
    });
  });

  describe("GET /internal/gpu-supply", () => {
    it("rejects a caller with no token", async () => {
      const response = await get("/internal/gpu-supply", { token: undefined });

      expect(response.status).toBe(401);
    });

    it("rejects a caller with the wrong token", async () => {
      const response = await get("/internal/gpu-supply", { token: faker.string.alphanumeric(32) });

      expect(response.status).toBe(401);
    });
  });

  it("stays out of the unauthenticated internal openapi document", async () => {
    const response = await app.request("/internal/doc");

    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("listGpuMarketPrices");
    expect(text).not.toContain("listGpuSupply");
  });

  async function seedPrices(rows: GpuMarketPriceInsert[]) {
    await container.resolve(GpuMarketPriceRepository).replaceAll(rows);
  }

  function aRow(overrides: Partial<GpuMarketPriceInsert>): GpuMarketPriceInsert {
    return {
      vendor: "nvidia",
      model: "h100",
      ram: "80Gi",
      interface: "sxm",
      area: null,
      source: "bid",
      lowUsdPerGpuHour: 1.5,
      medianUsdPerGpuHour: 2,
      highUsdPerGpuHour: 2.5,
      sampleCount: 12,
      providerCount: 4,
      newestSampleAt: new Date("2026-11-05T00:00:00.000Z"),
      windowDays: 30,
      computedAt: new Date("2026-11-06T03:37:00.000Z"),
      ...overrides
    };
  }

  async function get(path: string, options: { token?: string } = { token: internalToken }) {
    return app.request(path, { headers: options.token ? { "x-console-internal-token": options.token } : {} });
  }
});
