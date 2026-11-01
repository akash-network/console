import type { HttpClient } from "@akashnetwork/http-sdk";
import type { AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import type { ProviderConfigGpusType } from "@src/types/gpu";
import type { GpuRepository } from "../repositories/gpu.repository";
import { GpuFormattingService } from "./gpu-formatting/gpu-formatting.service";
import { GpuService } from "./gpu.service";

type GpuNode = Awaited<ReturnType<GpuRepository["getGpuList"]>>[number];

describe(GpuService.name, () => {
  describe("getGpuList", () => {
    it("lists a vendor named like a built-in object property as any other vendor", async () => {
      const { service, gpuRepository } = setup();
      gpuRepository.getGpuList.mockResolvedValue([
        createGpuNode({ vendor: "constructor", modelName: "a100" }),
        createGpuNode({ vendor: "__proto__", modelName: "h100" }),
        createGpuNode({ vendor: "nvidia", modelName: "rtx4090" })
      ]);

      const { gpus } = await service.getGpuList();

      expect(Object.entries(gpus.details)).toEqual([
        ["constructor", [{ model: "a100", ram: "80Gi", interface: "PCIe", allocatable: 8, allocated: 2 }]],
        ["__proto__", [{ model: "h100", ram: "80Gi", interface: "PCIe", allocatable: 8, allocated: 2 }]],
        ["nvidia", [{ model: "rtx4090", ram: "80Gi", interface: "PCIe", allocatable: 8, allocated: 2 }]]
      ]);
    });

    function createGpuNode(overrides: Partial<GpuNode>): GpuNode {
      return {
        hostUri: "https://provider.example.com:8443",
        name: "node-1",
        allocatable: 8,
        allocated: 2,
        modelId: "2330",
        vendor: "nvidia",
        modelName: "h100",
        interface: "PCIe",
        memorySize: "80Gi",
        ...overrides
      };
    }
  });

  describe("getGpuModels", () => {
    it("fetches the provider-config catalog and returns the formatted vendor list", async () => {
      const { service, httpClient } = setup({
        catalog: { "10de": { name: "nvidia", devices: { d1: { name: "rtx4090", memory_size: "24Gi", interface: "PCIe" } } } }
      });

      const [vendor] = await service.getGpuModels();

      expect(httpClient.get).toHaveBeenCalledWith("/gpus.json");
      expect(vendor).toMatchObject({ name: "nvidia", displayName: "NVIDIA" });
      expect(vendor.models[0]).toMatchObject({ name: "rtx4090", displayName: "RTX 4090" });
    });

    it("fetches the catalog once across repeated calls", async () => {
      const { service, httpClient } = setup();

      await service.getGpuModels();
      await service.getGpuModels();

      expect(httpClient.get).toHaveBeenCalledTimes(1);
    });

    it("keeps its own fetch rather than reading the catalog cache the resolver uses", async () => {
      const { service, httpClient } = setup();

      await service.getGpuModelCatalog();
      await service.getGpuModels();

      expect(httpClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("getGpuBreakdown", () => {
    const window = { startDate: "2024-01-01", endDate: "2024-01-31" };

    it("serves a repeated query from cache", async () => {
      const { service, gpuRepository } = setup();
      gpuRepository.getGpuBreakdown.mockResolvedValue([]);

      await service.getGpuBreakdown({ ...window, vendor: "nvidia" });
      await service.getGpuBreakdown({ ...window, vendor: "nvidia" });

      expect(gpuRepository.getGpuBreakdown).toHaveBeenCalledTimes(1);
    });

    it("distinguishes filter values that contain '#' characters", async () => {
      const { service, gpuRepository } = setup();
      gpuRepository.getGpuBreakdown.mockResolvedValue([]);

      await service.getGpuBreakdown({ ...window, vendor: "a", model: "b#c" });
      await service.getGpuBreakdown({ ...window, vendor: "a#b", model: "c" });

      expect(gpuRepository.getGpuBreakdown).toHaveBeenCalledTimes(2);
    });

    it("fetches fresh results when the filters differ", async () => {
      const { service, gpuRepository } = setup();
      gpuRepository.getGpuBreakdown.mockResolvedValue([]);

      await service.getGpuBreakdown({ ...window });
      await service.getGpuBreakdown({ ...window, vendor: "nvidia" });
      await service.getGpuBreakdown({ ...window, model: "nvidia" });

      expect(gpuRepository.getGpuBreakdown).toHaveBeenCalledTimes(3);
    });

    it("fetches fresh results when the date range differs", async () => {
      const { service, gpuRepository } = setup();
      gpuRepository.getGpuBreakdown.mockResolvedValue([]);

      await service.getGpuBreakdown({ ...window, vendor: "nvidia" });
      await service.getGpuBreakdown({ startDate: "2024-02-01", endDate: "2024-02-29", vendor: "nvidia" });

      expect(gpuRepository.getGpuBreakdown).toHaveBeenCalledTimes(2);
    });
  });

  function setup(input?: { catalog?: ProviderConfigGpusType }) {
    cacheEngine.clearAllKeyInCache();
    const httpClient = mock<HttpClient>();
    const response = mock<AxiosResponse<ProviderConfigGpusType>>();
    response.data = input?.catalog ?? {};
    httpClient.get.mockResolvedValue(response);

    const gpuRepository = mock<GpuRepository>();
    const service = new GpuService(gpuRepository, new GpuFormattingService(), httpClient);
    return { service, httpClient, gpuRepository };
  }
});
