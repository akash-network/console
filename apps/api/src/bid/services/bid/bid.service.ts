import { Bid, BidHttpService } from "@akashnetwork/http-sdk";
import assert from "http-assert";
import semver, { SemVer } from "semver";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { ProviderService } from "@src/provider/services/provider/provider.service";

@singleton()
export class BidService {
  static JWT_AUTH_SUPPORT_VERSION = new SemVer("0.8.3-rc0");

  constructor(
    private readonly bidHttpService: BidHttpService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly providerService: ProviderService,
    private readonly billingConfig: BillingConfigService,
    private readonly providerRepository: ProviderRepository
  ) {}

  async list(dseq: string): Promise<(Bid & { isCertificateRequired: boolean })[]> {
    const { ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findFirst();
    assert(userWallet?.address, 404, "UserWallet Not Found");

    const bids = await this.bidHttpService.list(userWallet.address, dseq);

    const filteredBids = await this.filterBidsByAuditedProviders(bids);

    return await Promise.all(filteredBids.map(bid => this.decorateWithCertRequirement(bid)));
  }

  private async filterBidsByAuditedProviders(bids: Bid[]): Promise<Bid[]> {
    const allowedAuditors = this.billingConfig.get("MANAGED_WALLET_LEASE_ALLOWED_AUDITORS");

    if (!allowedAuditors || allowedAuditors.length === 0 || bids.length === 0) {
      return bids;
    }

    const providerAddresses = Array.from(new Set(bids.map(bid => bid.bid.id.provider)));
    const providers = await this.providerRepository.getProvidersByAddressesWithAttributes(providerAddresses);
    const auditedProviderAddresses = new Set(
      providers
        .filter(provider => {
          const signatures = provider.providerAttributeSignatures ?? [];
          const providerAuditors = signatures.map(signature => signature.auditor);
          return providerAuditors.some(auditor => allowedAuditors.includes(auditor));
        })
        .map(provider => provider.owner)
    );

    return bids.filter(bid => auditedProviderAddresses.has(bid.bid.id.provider));
  }

  private async decorateWithCertRequirement<T extends Bid>(bid: T): Promise<T & { isCertificateRequired: boolean }> {
    const provider = await this.providerService.getProvider(bid.bid.id.provider);
    return {
      ...bid,
      isCertificateRequired: !provider || !semver.valid(provider.akashVersion) || semver.lt(provider.akashVersion, BidService.JWT_AUTH_SUPPORT_VERSION)
    };
  }
}
