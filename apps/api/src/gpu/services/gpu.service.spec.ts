import type { HttpClient } from "@akashnetwork/http-sdk";
import type { AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import type { ProviderConfigGpusType } from "@src/types/gpu";
import type { GpuRepository } from "../repositories/gpu.repository";
import { GpuFormattingService } from "./gpu-formatting/gpu-formatting.service";
import { GpuService } from "./gpu.service";

describe(GpuService.name, () => {
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
  });

  describe("getGpuBreakdown", () => {
    it("serves a repeated query from cache", async () => {
      const { service, gpuRepository } = setup();
      gpuRepository.getGpuBreakdown.mockResolvedValue([]);

      await service.getGpuBreakdown({ vendor: "nvidia" });
      await service.getGpuBreakdown({ vendor: "nvidia" });

      expect(gpuRepository.getGpuBreakdown).toHaveBeenCalledTimes(1);
    });

    it("fetches fresh results when the filters differ", async () => {
      const { service, gpuRepository } = setup();
      gpuRepository.getGpuBreakdown.mockResolvedValue([]);

      await service.getGpuBreakdown({});
      await service.getGpuBreakdown({ vendor: "nvidia" });
      await service.getGpuBreakdown({ model: "nvidia" });

      expect(gpuRepository.getGpuBreakdown).toHaveBeenCalledTimes(3);
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
