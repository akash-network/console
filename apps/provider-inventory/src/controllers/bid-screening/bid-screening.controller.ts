import { singleton } from "tsyringe";

import type { BidScreeningRequest, BidScreeningResponse } from "@src/http-schemas/bid-screening.schema";
import type { GroupSpecJSON } from "@src/lib/groupspec-mapper/groupspec-mapper";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- tsyringe needs a value import for constructor injection
import { BidScreeningService } from "@src/services/bid-screening/bid-screening.service";

@singleton()
export class BidScreeningController {
  readonly #bidScreeningService: BidScreeningService;

  constructor(bidScreeningService: BidScreeningService) {
    this.#bidScreeningService = bidScreeningService;
  }

  async screenProviders(request: BidScreeningRequest): Promise<BidScreeningResponse> {
    const results = await this.#bidScreeningService.findMatchingProviders(request as GroupSpecJSON);
    return { providers: results };
  }
}
