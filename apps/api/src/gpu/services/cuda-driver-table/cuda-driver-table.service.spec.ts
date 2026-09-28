import type { HttpClient } from "@akashnetwork/http-sdk";
import { hoursToMilliseconds } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { BUNDLED_CUDA_MINIMUM_DRIVERS } from "@src/gpu/lib/cuda-version/cuda-version";
import { CudaDriverTableService } from "./cuda-driver-table.service";

const LISTING = "<a href='cuda-compat-13-5_620.10.01-1ubuntu1_amd64.deb'>cuda-compat-13-5_620.10.01-1ubuntu1_amd64.deb</a>";

const CUDA_13_5 = { cudaVersion: "13.5", minimumDriver: [620, 10, 1] };

describe(CudaDriverTableService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getMinimumDrivers", () => {
    it("adds the cuda versions NVIDIA's repository lists to the bundled table", async () => {
      const { service, cudaRepoClient } = setup();
      cudaRepoClient.get.mockResolvedValue({
        data: [LISTING, "<a href='cuda-compat-12-4_550.90.07-1_amd64.deb'>cuda-compat-12-4_550.90.07-1_amd64.deb</a>"].join("\n")
      });

      const minimumDrivers = await service.getMinimumDrivers();

      expect(minimumDrivers).toHaveLength(BUNDLED_CUDA_MINIMUM_DRIVERS.length + 1);
      expect(minimumDrivers).toEqual(expect.arrayContaining([{ cudaVersion: "12.4", minimumDriver: [550, 54, 14] }, CUDA_13_5]));
    });

    it("fetches the repository listing as text", async () => {
      const { service, cudaRepoClient } = setup();
      cudaRepoClient.get.mockResolvedValue({ data: LISTING });

      await service.getMinimumDrivers();

      expect(cudaRepoClient.get).toHaveBeenCalledWith("/", { responseType: "text" });
    });

    it("answers the bundled table when the first refresh outlasts its wait, and the refreshed one once it lands", async () => {
      const { service, cudaRepoClient } = setup();
      let answer: (response: { data: string }) => void = () => {};
      cudaRepoClient.get.mockReturnValue(new Promise(resolve => (answer = resolve)));

      const whileRefreshing = service.getMinimumDrivers();
      await vi.advanceTimersByTimeAsync(500);

      await expect(whileRefreshing).resolves.toEqual(BUNDLED_CUDA_MINIMUM_DRIVERS);

      answer({ data: LISTING });
      await vi.advanceTimersByTimeAsync(0);

      expect(await service.getMinimumDrivers()).toContainEqual(CUDA_13_5);
      expect(cudaRepoClient.get).toHaveBeenCalledTimes(1);
    });

    it("leaves no timer behind once the first refresh lands", async () => {
      const { service, cudaRepoClient } = setup();
      cudaRepoClient.get.mockResolvedValue({ data: LISTING });

      await service.getMinimumDrivers();

      expect(vi.getTimerCount()).toBe(0);
    });

    it("answers the table it has without waiting on a later refresh", async () => {
      const { service, cudaRepoClient } = setup();
      cudaRepoClient.get.mockResolvedValueOnce({ data: LISTING }).mockReturnValueOnce(new Promise(() => {}));
      await service.getMinimumDrivers();
      vi.setSystemTime(Date.now() + hoursToMilliseconds(24));
      let answered: unknown;

      void service.getMinimumDrivers().then(minimumDrivers => (answered = minimumDrivers));
      await vi.advanceTimersByTimeAsync(0);

      expect(answered).toContainEqual(CUDA_13_5);
      expect(cudaRepoClient.get).toHaveBeenCalledTimes(2);
    });

    it("reads the listing again only a day after it last did", async () => {
      const { service, cudaRepoClient } = setup();
      cudaRepoClient.get.mockResolvedValue({ data: LISTING });

      await service.getMinimumDrivers();
      vi.setSystemTime(Date.now() + hoursToMilliseconds(24) - 1);
      await service.getMinimumDrivers();

      expect(cudaRepoClient.get).toHaveBeenCalledTimes(1);

      vi.setSystemTime(Date.now() + 1);
      await service.getMinimumDrivers();

      expect(cudaRepoClient.get).toHaveBeenCalledTimes(2);
    });

    it("keeps answering the table it has and logs when a later refresh fails", async () => {
      const error = new Error("socket hang up");
      const { service, cudaRepoClient, logger } = setup();
      cudaRepoClient.get.mockResolvedValueOnce({ data: LISTING }).mockRejectedValueOnce(error);

      await service.getMinimumDrivers();
      vi.setSystemTime(Date.now() + hoursToMilliseconds(24));
      const duringFailedRefresh = await service.getMinimumDrivers();
      await vi.advanceTimersByTimeAsync(0);

      expect(duringFailedRefresh).toContainEqual(CUDA_13_5);
      expect(await service.getMinimumDrivers()).toContainEqual(CUDA_13_5);
      expect(logger.warn).toHaveBeenCalledWith({ event: "CUDA_DRIVER_TABLE_REFRESH_FAILED", error });
    });

    it("retries a failed refresh an hour later rather than on every lookup", async () => {
      const error = new Error("socket hang up");
      const { service, cudaRepoClient, logger } = setup();
      cudaRepoClient.get.mockRejectedValue(error);

      expect(await service.getMinimumDrivers()).toEqual(BUNDLED_CUDA_MINIMUM_DRIVERS);
      vi.setSystemTime(Date.now() + hoursToMilliseconds(1) - 1);
      await service.getMinimumDrivers();

      expect(cudaRepoClient.get).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith({ event: "CUDA_DRIVER_TABLE_REFRESH_FAILED", error });

      vi.setSystemTime(Date.now() + 1);
      await service.getMinimumDrivers();

      expect(cudaRepoClient.get).toHaveBeenCalledTimes(2);
    });

    it("answers the bundled table and logs when the listing names no compat package", async () => {
      const { service, cudaRepoClient, logger } = setup();
      cudaRepoClient.get.mockResolvedValue({ data: "<html><body>moved</body></html>" });

      const minimumDrivers = await service.getMinimumDrivers();

      expect(minimumDrivers).toEqual(BUNDLED_CUDA_MINIMUM_DRIVERS);
      expect(logger.warn).toHaveBeenCalledWith({
        event: "CUDA_DRIVER_TABLE_REFRESH_FAILED",
        error: expect.objectContaining({ message: "NVIDIA's CUDA repository listing names no cuda-compat package" })
      });
    });
  });

  function setup() {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00.000Z"));
    const cudaRepoClient = mock<HttpClient>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new CudaDriverTableService(cudaRepoClient, createLogger);

    return { service, cudaRepoClient, logger };
  }
});
