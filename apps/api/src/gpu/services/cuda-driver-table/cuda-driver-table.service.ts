import type { HttpClient } from "@akashnetwork/http-sdk";
import { hoursToMilliseconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  BUNDLED_CUDA_MINIMUM_DRIVERS,
  type CudaMinimumDriver,
  mergeCudaMinimumDrivers,
  parseCudaCompatListing
} from "@src/gpu/lib/cuda-version/cuda-version";
import { CUDA_REPO_HTTP_CLIENT } from "@src/gpu/providers/cuda-repo-client.provider";

const LISTING_REFRESH_INTERVAL_MS = hoursToMilliseconds(24);

const FAILED_REFRESH_RETRY_MS = hoursToMilliseconds(1);

/** A lookup waits this long on the process's first refresh, then answers with the bundled table while the refresh carries on. */
const MAX_FIRST_REFRESH_WAIT_MS = 500;

@singleton()
export class CudaDriverTableService {
  readonly #logger: ReturnType<CreateLogger>;

  #minimumDrivers = BUNDLED_CUDA_MINIMUM_DRIVERS;

  #hasRefreshed = false;

  #nextRefreshAt = 0;

  #refresh: Promise<void> | null = null;

  constructor(
    @inject(CUDA_REPO_HTTP_CLIENT) private readonly cudaRepoClient: HttpClient,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: CudaDriverTableService.name });
  }

  async getMinimumDrivers(): Promise<CudaMinimumDriver[]> {
    const refresh = this.#refreshIfDue();
    if (refresh && !this.#hasRefreshed) await waitAtMost(refresh, MAX_FIRST_REFRESH_WAIT_MS);

    return this.#minimumDrivers;
  }

  #refreshIfDue(): Promise<void> | null {
    if (!this.#refresh && Date.now() >= this.#nextRefreshAt) {
      this.#refresh = this.#refreshMinimumDrivers().finally(() => {
        this.#refresh = null;
      });
    }

    return this.#refresh;
  }

  async #refreshMinimumDrivers(): Promise<void> {
    try {
      this.#minimumDrivers = await this.#fetchMinimumDrivers();
      this.#hasRefreshed = true;
      this.#nextRefreshAt = Date.now() + LISTING_REFRESH_INTERVAL_MS;
    } catch (error) {
      this.#logger.warn({ event: "CUDA_DRIVER_TABLE_REFRESH_FAILED", error });
      this.#nextRefreshAt = Date.now() + FAILED_REFRESH_RETRY_MS;
    }
  }

  async #fetchMinimumDrivers(): Promise<CudaMinimumDriver[]> {
    const { data } = await this.cudaRepoClient.get<string>("/", { responseType: "text" });
    const listed = parseCudaCompatListing(data);

    if (listed.length === 0) throw new Error("NVIDIA's CUDA repository listing names no cuda-compat package");

    return mergeCudaMinimumDrivers(BUNDLED_CUDA_MINIMUM_DRIVERS, listed);
  }
}

async function waitAtMost(work: Promise<void>, milliseconds: number): Promise<void> {
  let deadline: NodeJS.Timeout | undefined;

  try {
    await Promise.race([work, new Promise<void>(resolve => (deadline = setTimeout(resolve, milliseconds)))]);
  } finally {
    clearTimeout(deadline);
  }
}
