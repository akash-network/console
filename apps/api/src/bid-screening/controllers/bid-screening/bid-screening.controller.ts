import { singleton } from "tsyringe";

import type { GroupSpecJSON } from "@src/bid-screening/lib/groupspec-mapper/groupspec-mapper";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { BidScreeningRequest, BidScreeningResponse } from "../../http-schemas/bid-screening.schema";
import { BidScreeningService } from "../../services/bid-screening/bid-screening.service";

@singleton()
export class BidScreeningController {
  readonly #bidScreeningService: BidScreeningService;
  readonly #featureFlagsService: FeatureFlagsService;

  constructor(bidScreeningService: BidScreeningService, featureFlagsService: FeatureFlagsService) {
    this.#bidScreeningService = bidScreeningService;
    this.#featureFlagsService = featureFlagsService;
  }

  async screenProviders(request: BidScreeningRequest): Promise<BidScreeningResponse> {
    if (!this.#featureFlagsService.isEnabled(FeatureFlags.BID_SCREENING)) {
      return { providers: [] };
    }

    const results = await this.#bidScreeningService.findMatchingProviders(request as GroupSpecJSON);
    return { providers: results };
  }
}
