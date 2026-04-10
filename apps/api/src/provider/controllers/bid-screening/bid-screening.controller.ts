import { singleton } from "tsyringe";

import type { BidScreeningRequest, BidScreeningResponse } from "@src/provider/http-schemas/bid-screening.schema";
import { BidScreeningService } from "@src/provider/services/bid-screening/bid-screening.service";

@singleton()
export class BidScreeningController {
  constructor(private readonly bidScreeningService: BidScreeningService) {}

  async screen(input: BidScreeningRequest["data"]): Promise<BidScreeningResponse> {
    return { data: await this.bidScreeningService.findMatchingProviders(input) };
  }
}
