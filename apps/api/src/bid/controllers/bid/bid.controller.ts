import { BidHttpService } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import { ListBidsResponse } from "@src/bid/http-schemas/bid.schema";
import { UserWalletRepository } from "@src/billing/repositories";

@singleton()
export class BidController {
  constructor(
    private readonly bidHttpService: BidHttpService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async list(dseq: string, userId?: string): Promise<ListBidsResponse> {
    const { currentUser, ability } = this.authService;

    const wallets = await this.userWalletRepository.accessibleBy(ability, "sign").findByUserId(userId ?? currentUser.id);
    const bids = await this.bidHttpService.list(wallets[0].address, dseq);

    return { data: bids };
  }
}
