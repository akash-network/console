import type { Abortable } from "node:events";
import { inject, singleton } from "tsyringe";

import { BidScreeningInput, BidScreeningService } from "@src/services/bid-screening/bid-screening.service";
import type { BidScreeningRequest, BidScreeningResponse } from "../../http-schemas/bid-screening.schema";

@singleton()
export class BidScreeningController {
  readonly #bidScreeningService: BidScreeningService;

  constructor(@inject(BidScreeningService) bidScreeningService: BidScreeningService) {
    this.#bidScreeningService = bidScreeningService;
  }

  async screenProviders(request: BidScreeningRequest, options?: Abortable): Promise<BidScreeningResponse> {
    const results = await this.#bidScreeningService.findMatchingProviders(request as BidScreeningInput, options);
    return { providers: results };
  }
}
