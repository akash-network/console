import { inject, singleton } from "tsyringe";

import type { GroupSpecJSON } from "@src/lib/groupspec-mapper/groupspec-mapper";
import { BidScreeningService } from "@src/services/bid-screening/bid-screening.service";
import type { BidScreeningRequest, BidScreeningResponse } from "../../http-schemas/bid-screening.schema";

@singleton()
export class BidScreeningController {
  readonly #bidScreeningService: BidScreeningService;

  constructor(@inject(BidScreeningService) bidScreeningService: BidScreeningService) {
    this.#bidScreeningService = bidScreeningService;
  }

  async screenProviders(request: BidScreeningRequest): Promise<BidScreeningResponse> {
    const results = await this.#bidScreeningService.findMatchingProviders(request as GroupSpecJSON);
    return { providers: results };
  }
}
