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
        "10de": { name: "nvidia", devices: { d1: { name: "rtx4090", memory_size: "24Gi", interface: "PCIe" } } }
      });

      const [vendor] = await service.getGpuModels();

      expect(httpClient.get).toHaveBeenCalledWith("/gpus.json");
      expect(vendor).toMatchObject({ name: "nvidia", displayName: "NVIDIA" });
      expect(vendor.models[0]).toMatchObject({ name: "rtx4090", displayName: "RTX 4090" });
    });
  });

  function setup(catalog: ProviderConfigGpusType) {
    cacheEngine.clearAllKeyInCache();
    const httpClient = mock<HttpClient>();
    const response = mock<AxiosResponse<ProviderConfigGpusType>>();
    response.data = catalog;
    httpClient.get.mockResolvedValue(response);

    const service = new GpuService(mock<GpuRepository>(), new GpuFormattingService(), httpClient);
    return { service, httpClient };
  }
});
