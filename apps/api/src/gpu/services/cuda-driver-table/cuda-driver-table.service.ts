import type { HttpClient } from "@akashnetwork/http-sdk";
import { hoursToSeconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { cacheResponse } from "@src/caching/helpers";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  BUNDLED_CUDA_MINIMUM_DRIVERS,
  type CudaMinimumDriver,
  mergeCudaMinimumDrivers,
  parseCudaCompatListing
} from "@src/gpu/lib/cuda-version/cuda-version";
import { CUDA_REPO_HTTP_CLIENT } from "@src/gpu/providers/cuda-repo-client.provider";

const LISTING_REFRESH_INTERVAL_SECONDS = hoursToSeconds(24);

const LISTING_CACHE_KEY = "CudaDriverTableService#minimumDrivers";

@singleton()
export class CudaDriverTableService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    @inject(CUDA_REPO_HTTP_CLIENT) private readonly cudaRepoClient: HttpClient,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: CudaDriverTableService.name });
  }

  /** Falls back to the bundled table rather than failing, since a stale table only understates a driver's CUDA support. */
  async getMinimumDrivers(): Promise<CudaMinimumDriver[]> {
    try {
      return await cacheResponse(LISTING_REFRESH_INTERVAL_SECONDS, LISTING_CACHE_KEY, () => this.#fetchMinimumDrivers());
    } catch (error) {
      this.#logger.warn({ event: "CUDA_DRIVER_TABLE_REFRESH_FAILED", error });
      return BUNDLED_CUDA_MINIMUM_DRIVERS;
    }
  }

  async #fetchMinimumDrivers(): Promise<CudaMinimumDriver[]> {
    const { data } = await this.cudaRepoClient.get<string>("/", { responseType: "text" });
    const listed = parseCudaCompatListing(data);

    if (listed.length === 0) throw new Error("NVIDIA's CUDA repository listing names no cuda-compat package");

    return mergeCudaMinimumDrivers(BUNDLED_CUDA_MINIMUM_DRIVERS, listed);
  }
}
