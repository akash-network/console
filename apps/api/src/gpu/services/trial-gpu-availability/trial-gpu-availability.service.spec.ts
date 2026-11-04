import { faker } from "@faker-js/faker";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import type { GpuRepository } from "@src/gpu/repositories/gpu.repository";
import { TrialGpuAvailabilityService } from "./trial-gpu-availability.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

type GpuNode = Awaited<ReturnType<GpuRepository["getGpuList"]>>[number];

describe(TrialGpuAvailabilityService.name, () => {
  describe("getFreeTrialGpus", () => {
    it("counts only the providers signed by an allowed auditor", async () => {
      const { service, gpuRepository } = setup({ allowedAuditors: ["akash1auditor", "akash1otherauditor"], gpuNodes: [] });

      await service.getFreeTrialGpus();

      expect(gpuRepository.getGpuList).toHaveBeenCalledWith({ signedByAnyOf: ["akash1auditor", "akash1otherauditor"] });
    });

    it("sums free units per gpu model across nodes and providers", async () => {
      const { service } = setup({
        gpuNodes: [
          buildGpuNode({ vendor: "nvidia", modelName: "v100", allocatable: 8, allocated: 3 }),
          buildGpuNode({ vendor: "nvidia", modelName: "v100", allocatable: 4, allocated: 1 }),
          buildGpuNode({ vendor: "nvidia", modelName: "t4", allocatable: 2, allocated: 1 })
        ]
      });

      expect(await service.getFreeTrialGpus()).toEqual([
        { vendor: "nvidia", model: "v100", freeUnits: 8 },
        { vendor: "nvidia", model: "t4", freeUnits: 1 }
      ]);
    });

    it("never reports a gpu model on the trial block list", async () => {
      const { service } = setup({
        blockedGpuModels: ["nvidia/h100"],
        gpuNodes: [
          buildGpuNode({ vendor: "nvidia", modelName: "h100", allocatable: 8, allocated: 0 }),
          buildGpuNode({ vendor: "nvidia", modelName: "p4", allocatable: 2, allocated: 0 })
        ]
      });

      expect(await service.getFreeTrialGpus()).toEqual([{ vendor: "nvidia", model: "p4", freeUnits: 2 }]);
    });

    it("matches the block list regardless of the reported case", async () => {
      const { service } = setup({
        blockedGpuModels: ["nvidia/h100"],
        gpuNodes: [buildGpuNode({ vendor: "NVIDIA", modelName: "H100", allocatable: 8, allocated: 0 })]
      });

      expect(await service.getFreeTrialGpus()).toEqual([]);
    });

    it("reports vendor and model in lowercase as the sdl gpu attributes expect", async () => {
      const { service } = setup({
        gpuNodes: [
          buildGpuNode({ vendor: "NVIDIA", modelName: "RTX3060Ti", allocatable: 2, allocated: 0 }),
          buildGpuNode({ vendor: "nvidia", modelName: "rtx3060ti", allocatable: 2, allocated: 0 })
        ]
      });

      expect(await service.getFreeTrialGpus()).toEqual([{ vendor: "nvidia", model: "rtx3060ti", freeUnits: 4 }]);
    });

    it("omits gpu models with no free units", async () => {
      const { service } = setup({
        gpuNodes: [
          buildGpuNode({ vendor: "nvidia", modelName: "p40", allocatable: 1, allocated: 1 }),
          buildGpuNode({ vendor: "nvidia", modelName: "m4000", allocatable: 1, allocated: 0 })
        ]
      });

      expect(await service.getFreeTrialGpus()).toEqual([{ vendor: "nvidia", model: "m4000", freeUnits: 1 }]);
    });

    it("counts an over-allocated node as having no free units instead of subtracting from the others", async () => {
      const { service } = setup({
        gpuNodes: [
          buildGpuNode({ vendor: "nvidia", modelName: "v100", allocatable: 2, allocated: 5 }),
          buildGpuNode({ vendor: "nvidia", modelName: "v100", allocatable: 2, allocated: 0 })
        ]
      });

      expect(await service.getFreeTrialGpus()).toEqual([{ vendor: "nvidia", model: "v100", freeUnits: 2 }]);
    });

    it("skips nodes whose gpu vendor or model is unknown", async () => {
      const { service } = setup({
        gpuNodes: [
          buildGpuNode({ vendor: null, modelName: "v100", allocatable: 2, allocated: 0 }),
          buildGpuNode({ vendor: "nvidia", modelName: null, allocatable: 2, allocated: 0 })
        ]
      });

      expect(await service.getFreeTrialGpus()).toEqual([]);
    });

    it("returns an empty list when no allowed gpu has free units", async () => {
      const { service } = setup({ gpuNodes: [buildGpuNode({ vendor: "nvidia", modelName: "t4", allocatable: 1, allocated: 1 })] });

      expect(await service.getFreeTrialGpus()).toEqual([]);
    });

    it("orders by most free units, then by vendor and model", async () => {
      const { service } = setup({
        gpuNodes: [
          buildGpuNode({ vendor: "nvidia", modelName: "t4", allocatable: 1, allocated: 0 }),
          buildGpuNode({ vendor: "nvidia", modelName: "v100", allocatable: 8, allocated: 0 }),
          buildGpuNode({ vendor: "nvidia", modelName: "p40", allocatable: 1, allocated: 0 }),
          buildGpuNode({ vendor: "amd", modelName: "mi60", allocatable: 1, allocated: 0 })
        ]
      });

      expect(await service.getFreeTrialGpus()).toEqual([
        { vendor: "nvidia", model: "v100", freeUnits: 8 },
        { vendor: "amd", model: "mi60", freeUnits: 1 },
        { vendor: "nvidia", model: "p40", freeUnits: 1 },
        { vendor: "nvidia", model: "t4", freeUnits: 1 }
      ]);
    });

    it("serves repeated calls from cache", async () => {
      const { service, gpuRepository } = setup({ gpuNodes: [] });

      await service.getFreeTrialGpus();
      await service.getFreeTrialGpus();

      expect(gpuRepository.getGpuList).toHaveBeenCalledTimes(1);
    });

    it("reads the providers again once the cached answer is a minute old", async () => {
      const advanceCacheClockTo = await mockCacheClock();
      const { service, gpuRepository } = setup({ gpuNodes: [] });

      await service.getFreeTrialGpus();
      await advanceCacheClockTo(59_000);
      await service.getFreeTrialGpus();
      await advanceCacheClockTo(61_000);
      await service.getFreeTrialGpus();

      expect(gpuRepository.getGpuList).toHaveBeenCalledTimes(2);
    });

    it("propagates a failed read instead of reporting no gpus, and retries on the next call", async () => {
      const { service, gpuRepository } = setup({ gpuNodes: [] });
      gpuRepository.getGpuList.mockRejectedValueOnce(new Error("connection refused"));

      await expect(service.getFreeTrialGpus()).rejects.toThrow("connection refused");
      expect(await service.getFreeTrialGpus()).toEqual([]);
      expect(gpuRepository.getGpuList).toHaveBeenCalledTimes(2);
    });
  });

  function setup(input: { gpuNodes: GpuNode[]; allowedAuditors?: string[]; blockedGpuModels?: string[] }) {
    const gpuRepository = mock<GpuRepository>();
    gpuRepository.getGpuList.mockResolvedValue(input.gpuNodes);
    const billingConfig = mockConfigService<BillingConfigService>({
      MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: input.allowedAuditors ?? ["akash1auditor"],
      MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: input.blockedGpuModels ?? []
    });
    const service = new TrialGpuAvailabilityService(gpuRepository, billingConfig, new BlockedGpuService(billingConfig));

    return { service, gpuRepository };
  }

  async function mockCacheClock() {
    const startedAt = 1_000;
    const performanceNow = vi.spyOn(performance, "now").mockReturnValue(startedAt);
    onTestFinished(() => performanceNow.mockRestore());

    return async (elapsedMs: number) => {
      performanceNow.mockReturnValue(startedAt + elapsedMs);
      await new Promise(resolve => setTimeout(resolve, 5));
    };
  }

  function buildGpuNode(overrides: { vendor: string | null; modelName: string | null; allocatable: number; allocated: number }): GpuNode {
    return {
      hostUri: faker.internet.url(),
      name: faker.string.alphanumeric(8),
      modelId: faker.string.alphanumeric(4),
      interface: "pcie",
      memorySize: "16Gi",
      ...overrides
    } as GpuNode;
  }
});
