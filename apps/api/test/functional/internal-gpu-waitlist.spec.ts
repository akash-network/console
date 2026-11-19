import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";

import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("Internal GPU waitlist demand route", () => {
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;
  const featureFlagsService = container.resolve(FeatureFlagsService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /internal/v1/gpu-waitlist/demand", () => {
    it("refuses requests without the internal token", async () => {
      setup({ flagOn: true });

      expect((await get({ token: undefined })).status).toBe(401);
      expect((await get({ token: faker.string.alphanumeric(32) })).status).toBe(401);
    });

    it("counts waiting people per gpu setup without identities", async () => {
      setup({ flagOn: true });
      const model = `H100-${faker.string.alphanumeric(10)}`;
      const oldest = new Date("2026-11-01T10:00:00.000Z");
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model, gpuCount: 8, memory: "80Gi", interface: "sxm", joinedAt: oldest });
      await seedGpuWaitlistEntry({
        userId: (await seedUser()).id,
        model,
        gpuCount: 8,
        memory: "80Gi",
        interface: "sxm",
        joinedAt: new Date("2026-11-05T10:00:00.000Z")
      });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model, gpuCount: 1, joinedAt: new Date("2026-11-03T10:00:00.000Z") });
      await seedGpuWaitlistEntry({ userId: (await seedUser()).id, model, gpuCount: 1, status: "left" });

      const response = await get({ token: internalToken });

      expect(response.status).toBe(200);
      const { data } = (await response.json()) as { data: { model: string }[] };
      expect(data.filter(row => row.model === model)).toEqual([
        { vendor: "nvidia", model, memory: "80Gi", interface: "sxm", gpuCount: 8, waiting: 2, oldestJoinedAt: oldest.toISOString() },
        { vendor: "nvidia", model, memory: null, interface: null, gpuCount: 1, waiting: 1, oldestJoinedAt: "2026-11-03T10:00:00.000Z" }
      ]);
    });

    it("answers 404 while the feature flag is off", async () => {
      setup({ flagOn: false });

      expect((await get({ token: internalToken })).status).toBe(404);
    });
  });

  it("stays out of the unauthenticated internal openapi document", async () => {
    const response = await app.request("/internal/doc");

    expect(JSON.stringify(await response.json())).not.toContain("listGpuWaitlistDemand");
  });

  function setup(input: { flagOn: boolean }) {
    vi.spyOn(featureFlagsService, "isEnabled").mockImplementation(flag => input.flagOn || flag !== FeatureFlags.GPU_AVAILABILITY_ALERTS);
  }

  async function get(options: { token?: string }) {
    return app.request("/internal/v1/gpu-waitlist/demand", { headers: options.token ? { "x-console-internal-token": options.token } : {} });
  }
});
