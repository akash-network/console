import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import { ListBidsResponse } from "@src/bid/http-schemas/bid.schema";
import { BidService } from "@src/bid/services/bid/bid.service";

@singleton()
export class BidController {
  constructor(private readonly bidService: BidService) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async list(dseq: string): Promise<ListBidsResponse> {
    const bids = await this.bidService.list(dseq);

    return { data: bids };
  }
}
