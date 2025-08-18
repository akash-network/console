import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { ListBidsResponse } from "@src/bid/http-schemas/bid.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import { BidHttpServiceWrapper } from "@src/core/services/http-service-wrapper/http-service-wrapper";

@singleton()
export class BidController {
  constructor(
    private readonly bidHttpServiceWrapper: BidHttpServiceWrapper,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async list(dseq: string, userId?: string): Promise<ListBidsResponse> {
    const { currentUser, ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(userId ?? currentUser.id);
    assert(userWallet?.address, 404, "UserWallet Not Found");

    const bids = await this.bidHttpServiceWrapper.list(userWallet.address, dseq);

    return { data: bids as ListBidsResponse["data"] };
  }
}
