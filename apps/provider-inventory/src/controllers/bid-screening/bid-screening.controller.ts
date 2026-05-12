import { singleton } from "tsyringe";

import type { BidScreeningResponse } from "../../http-schemas/bid-screening.schema";

@singleton()
export class BidScreeningController {
  async screenProviders(): Promise<BidScreeningResponse> {
    return { providers: [] };
  }
}
