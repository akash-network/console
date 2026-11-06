import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import type { UnmetDemandResponse } from "@src/deployment/http-schemas/unmet-demand.schema";
import { type UnmetDemandEventInsert, UnmetDemandEventRepository } from "@src/deployment/repositories/unmet-demand-event/unmet-demand-event.repository";
import { type GpuMarketPriceInsert, GpuMarketPriceRepository } from "@src/gpu/repositories/gpu-market-price/gpu-market-price.repository";
import { app, initDb } from "@src/rest-app";

import { createAkashBlock, createDay, createProvider, createProviderSnapshot, createProviderSnapshotNode, createProviderSnapshotNodeGpu } from "@test/seeders";
import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { createHardwareRequestSpec } from "@test/seeders/hardware-request.seeder";
import { formatUTCDate } from "@test/utils";

describe("Internal unmet demand route", () => {
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;

  describe("GET /internal/unmet-demand", () => {
    it("rejects a caller with no token", async () => {
      const response = await get("/internal/unmet-demand", { token: undefined });

      expect(response.status).toBe(401);
    });

    it("rejects a caller with the wrong token", async () => {
      const response = await get("/internal/unmet-demand", { token: faker.string.alphanumeric(32) });

      expect(response.status).toBe(401);
    });

    it("reaches 30 days back unless asked otherwise", async () => {
      const response = await get("/internal/unmet-demand");

      const { since } = (await response.json()) as UnmetDemandResponse;
      const daysBack = (Date.now() - new Date(since).getTime()) / (24 * 3_600_000);
      expect(daysBack).toBeCloseTo(30, 2);
    });

    it("refuses a window longer than 90 days or shorter than one", async () => {
      expect((await get("/internal/unmet-demand?days=91")).status).toBe(400);
      expect((await get("/internal/unmet-demand?days=0")).status).toBe(400);
    });

    it("reports the unmet demand of the window per model and area, with the requests, live supply and market prices around it", async () => {
      const { model } = await setup();

      const response = await get("/internal/unmet-demand?days=7");

      expect(response.status).toBe(200);
      const body = (await response.json()) as UnmetDemandResponse;
      expect(body.since).toEqual(expect.any(String));
      expect(body.data).toEqual([
        {
          vendor: "nvidia",
          model,
          regionArea: null,
          noFit: 2,
          missingGpu: 0,
          zeroBid: 1,
          totalUnmet: 3,
          gpusAsked: 12,
          hardwareRequests: 2,
          supply: { allocatable: 8, available: 6, biddingProviders: 0, biddingProvidersInArea: null },
          marketMedianUsdPerGpuHour: { allRegions: { bid: 2, lease: 1.8 }, area: null }
        },
        {
          vendor: "nvidia",
          model,
          regionArea: "eu",
          noFit: 0,
          missingGpu: 1,
          zeroBid: 0,
          totalUnmet: 1,
          gpusAsked: 4,
          hardwareRequests: 1,
          supply: { allocatable: 8, available: 6, biddingProviders: 0, biddingProvidersInArea: 0 },
          marketMedianUsdPerGpuHour: { allRegions: { bid: 2, lease: 1.8 }, area: { bid: 2.4, lease: null } }
        }
      ] satisfies UnmetDemandResponse["data"]);
    });
  });

  it("stays out of the unauthenticated internal openapi document", async () => {
    const response = await app.request("/internal/doc");

    expect(JSON.stringify(await response.json())).not.toContain("listUnmetDemand");
  });

  async function setup() {
    const model = `h100-${faker.string.alphanumeric({ length: 8, casing: "lower" })}`;
    const now = new Date();

    await seedUnmetDemand([
      anEvent({ model, kind: "no_fit", gpuCount: 8 }),
      anEvent({ model, kind: "no_fit", gpuCount: 2 }),
      anEvent({ model, kind: "zero_bid", gpuCount: 2 }),
      anEvent({ model, kind: "missing_gpu", gpuCount: 4, regionArea: "eu" }),
      anEvent({ model, kind: "no_fit", gpuCount: 64, occurredAt: new Date(now.getTime() - 8 * 24 * 3_600_000) })
    ]);
    await seedHardwareRequest({ userId: null, gpuModel: model.toUpperCase() });
    await seedHardwareRequest({
      userId: null,
      category: "quote",
      gpuModel: null,
      spec: createHardwareRequestSpec({ gpu: { model: `NVIDIA ${model}`, count: 8, interconnect: "none" }, region: { mode: "only", areas: ["us"] } })
    });
    await container
      .resolve(GpuMarketPriceRepository)
      .replaceAll([
        aPrice({ model, area: null, source: "bid", medianUsdPerGpuHour: 2 }),
        aPrice({ model, area: null, source: "lease", medianUsdPerGpuHour: 1.8 }),
        aPrice({ model, area: "eu", source: "bid", medianUsdPerGpuHour: 2.4 })
      ]);
    await seedOnlineGpu({ model, allocatable: 8, allocated: 2, now });

    return { model };
  }

  async function seedUnmetDemand(events: UnmetDemandEventInsert[]) {
    await container.resolve(UnmetDemandEventRepository).insertMany(events);
  }

  function anEvent(overrides: Partial<UnmetDemandEventInsert>): UnmetDemandEventInsert {
    return {
      kind: "no_fit",
      vendor: "nvidia",
      model: "h100",
      gpuCount: 1,
      regionArea: null,
      dedupeKey: faker.string.hexadecimal({ length: 64, prefix: "" }).toLowerCase(),
      occurredAt: new Date(),
      ...overrides
    };
  }

  function aPrice(overrides: Partial<GpuMarketPriceInsert>): GpuMarketPriceInsert {
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
      newestSampleAt: new Date(),
      windowDays: 30,
      computedAt: new Date(),
      ...overrides
    };
  }

  async function seedOnlineGpu(input: { model: string; allocatable: number; allocated: number; now: Date }) {
    await initDb();
    const day = await createDay({ date: formatUTCDate(input.now), aktPrice: 1, firstBlockHeight: 1, lastBlockHeight: 100, lastBlockHeightYet: 100 });
    await createAkashBlock({ dayId: day.id, datetime: input.now, height: 100 });
    const provider = await createProvider({ isOnline: true });
    const snapshot = await createProviderSnapshot({ owner: provider.owner, checkDate: input.now, isOnline: true });
    const node = await createProviderSnapshotNode({ snapshotId: snapshot.id, gpuAllocatable: input.allocatable, gpuAllocated: input.allocated });
    await createProviderSnapshotNodeGpu({ snapshotNodeId: node.id, vendor: "nvidia", name: input.model, interface: "sxm", memorySize: 81920 });
    await provider.update({ lastSuccessfulSnapshotId: snapshot.id });
  }

  async function get(path: string, options: { token?: string } = { token: internalToken }) {
    return app.request(path, { headers: options.token ? { "x-console-internal-token": options.token } : {} });
  }
});
