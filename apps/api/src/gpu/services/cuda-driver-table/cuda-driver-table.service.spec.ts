import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import type { CreateLogger } from "@src/core";
import { BUNDLED_CUDA_MINIMUM_DRIVERS } from "@src/gpu/lib/cuda-version/cuda-version";
import { CudaDriverTableService } from "./cuda-driver-table.service";

describe(CudaDriverTableService.name, () => {
  describe("getMinimumDrivers", () => {
    it("adds the cuda versions NVIDIA's repository lists to the bundled table", async () => {
      const { service } = setup({
        listing: [
          "<a href='cuda-compat-12-4_550.90.07-1_amd64.deb'>cuda-compat-12-4_550.90.07-1_amd64.deb</a>",
          "<a href='cuda-compat-13-5_620.10.01-1ubuntu1_amd64.deb'>cuda-compat-13-5_620.10.01-1ubuntu1_amd64.deb</a>"
        ].join("\n")
      });

      const minimumDrivers = await service.getMinimumDrivers();

      expect(minimumDrivers).toHaveLength(BUNDLED_CUDA_MINIMUM_DRIVERS.length + 1);
      expect(minimumDrivers).toEqual(
        expect.arrayContaining([
          { cudaVersion: "12.4", minimumDriver: [550, 54, 14] },
          { cudaVersion: "13.5", minimumDriver: [620, 10, 1] }
        ])
      );
    });

    it("fetches the repository listing as text", async () => {
      const { service, cudaRepoClient } = setup({ listing: "<a href='cuda-compat-13-5_620.10.01-1ubuntu1_amd64.deb'>" });

      await service.getMinimumDrivers();

      expect(cudaRepoClient.get).toHaveBeenCalledWith("/", { responseType: "text" });
    });

    it("reads the listing once for repeated lookups", async () => {
      const { service, cudaRepoClient } = setup({ listing: "<a href='cuda-compat-13-5_620.10.01-1ubuntu1_amd64.deb'>" });

      await service.getMinimumDrivers();
      await service.getMinimumDrivers();

      expect(cudaRepoClient.get).toHaveBeenCalledTimes(1);
    });

    it("answers the bundled table and logs when the listing cannot be fetched", async () => {
      const error = new Error("socket hang up");
      const { service, cudaRepoClient, logger } = setup({ listing: "" });
      cudaRepoClient.get.mockRejectedValue(error);

      const minimumDrivers = await service.getMinimumDrivers();

      expect(minimumDrivers).toEqual(BUNDLED_CUDA_MINIMUM_DRIVERS);
      expect(logger.warn).toHaveBeenCalledWith({ event: "CUDA_DRIVER_TABLE_REFRESH_FAILED", error });
    });

    it("answers the bundled table and logs when the listing names no compat package", async () => {
      const { service, logger } = setup({ listing: "<html><body>moved</body></html>" });

      const minimumDrivers = await service.getMinimumDrivers();

      expect(minimumDrivers).toEqual(BUNDLED_CUDA_MINIMUM_DRIVERS);
      expect(logger.warn).toHaveBeenCalledWith({
        event: "CUDA_DRIVER_TABLE_REFRESH_FAILED",
        error: expect.objectContaining({ message: "NVIDIA's CUDA repository listing names no cuda-compat package" })
      });
    });
  });

  function setup(input: { listing: string }) {
    cacheEngine.clearAllKeyInCache();
    const cudaRepoClient = mock<HttpClient>();
    cudaRepoClient.get.mockResolvedValue({ data: input.listing });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new CudaDriverTableService(cudaRepoClient, createLogger);

    return { service, cudaRepoClient, logger };
  }
});
