import { Bid, BidHttpService } from "@akashnetwork/http-sdk";
import assert from "http-assert";
import semver, { SemVer } from "semver";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { ProviderService } from "@src/provider/services/provider/provider.service";

@singleton()
export class BidService {
  static JWT_AUTH_SUPPORT_VERSION = new SemVer("0.8.3-rc0");

  constructor(
    private readonly bidHttpService: BidHttpService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly providerService: ProviderService
  ) {}

  async list(dseq: string): Promise<(Bid & { isCertificateRequired: boolean })[]> {
    const { ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findFirst();
    assert(userWallet?.address, 404, "UserWallet Not Found");

    const bids = await this.bidHttpService.list(userWallet.address, dseq);

    return await Promise.all(bids.map(bid => this.decorateWithCertRequirement(bid)));
  }

  private async decorateWithCertRequirement<T extends Bid>(bid: T): Promise<T & { isCertificateRequired: boolean }> {
    const provider = await this.providerService.getProvider(bid.bid.bid_id.provider);
    return {
      ...bid,
      isCertificateRequired: !provider || !semver.valid(provider.akashVersion) || semver.lt(provider.akashVersion, BidService.JWT_AUTH_SUPPORT_VERSION)
    };
  }
}
