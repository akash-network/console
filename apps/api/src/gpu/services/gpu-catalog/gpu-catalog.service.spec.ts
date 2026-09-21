import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { GpuService } from "@src/gpu/services/gpu.service";
import type { ProviderConfigGpusType } from "@src/types/gpu";
import { GpuCatalogService } from "./gpu-catalog.service";

const CATALOG: ProviderConfigGpusType = {
  "10de": { name: "nvidia", devices: { "2330": { name: "h100", memory_size: "80Gi", interface: "SXM5" } } }
};

describe(GpuCatalogService.name, () => {
  it("indexes the published catalog by pci id and by model", async () => {
    const { service } = setup({ catalog: CATALOG });

    const index = await service.getIndex();

    expect(index?.byPciId.get("10de:2330")).toEqual({ vendor: "nvidia", model: "h100", memorySize: "80Gi", interface: "sxm" });
    expect(index?.byModel.get("h100")?.model).toBe("h100");
  });

  it("answers with nothing when the catalog cannot be reached", async () => {
    const { service } = setup({ error: new Error("network is unreachable") });

    await expect(service.getIndex()).resolves.toBeNull();
  });

  function setup(input: { catalog?: ProviderConfigGpusType; error?: Error }) {
    const gpuService = mock<GpuService>({
      getGpuModelCatalog: input.error ? () => Promise.reject(input.error) : () => Promise.resolve(input.catalog ?? {})
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new GpuCatalogService(gpuService, vi.fn<CreateLogger>(() => logger));

    return { service, gpuService, logger };
  }
});
