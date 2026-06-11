import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import type { Abortable } from "node:events";
import { inject, singleton } from "tsyringe";

import { BID_SCREENING_CONFIG, type BidScreeningConfig } from "@src/bid-screening/providers/config.provider";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { BidScreeningRequest, BidScreeningResponse } from "../../http-schemas/bid-screening.schema";

@singleton()
export class BidScreeningController {
  readonly #featureFlagsService: FeatureFlagsService;
  readonly #bidScreeningConfig: BidScreeningConfig;

  constructor(featureFlagsService: FeatureFlagsService, @inject(BID_SCREENING_CONFIG) config: BidScreeningConfig) {
    this.#featureFlagsService = featureFlagsService;
    this.#bidScreeningConfig = config;
  }

  async screenProviders(request: BidScreeningRequest, options?: Abortable): Promise<BidScreeningResponse> {
    if (!this.#featureFlagsService.isEnabled(FeatureFlags.BID_SCREENING)) {
      return { providers: [] };
    }

    const baseUrl = this.#bidScreeningConfig.PROVIDER_INVENTORY_API_URL;
    const url = new URL("/v1/bid-screening", baseUrl);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: options?.signal
      });
    } catch (error) {
      throw new HTTPException(503, {
        cause: error,
        message: "Failed to screen providers."
      });
    }

    if (!response.ok) {
      throw new HTTPException(response.status as StatusCode, {
        res: response,
        message: `Provider inventory bid-screening failed.`
      });
    }

    return (await response.json()) as BidScreeningResponse;
  }
}
