import createError from "http-errors";
import { singleton } from "tsyringe";

import { type FundingWalletOutput, FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { TxService } from "@src/core/services";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";

/** Answers which funding wallet backs a user wallet, so a network can have more than one over time; with the flag off, or with one wallet registered, that is always the configured wallet. */
@singleton()
export class FundingWalletRegistryService {
  constructor(
    private readonly fundingWalletRepository: FundingWalletRepository,
    private readonly txManagerService: TxManagerService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly coreConfigService: CoreConfigService,
    private readonly txService: TxService
  ) {}

  get #network() {
    return this.coreConfigService.get("NETWORK");
  }

  /** Read for the network rather than the caller, so a request and a background job agree on which wallet backs a user. */
  get #isEnabled() {
    return this.featureFlagsService.isEnabledForSubject(FeatureFlags.FUNDING_WALLET_REGISTRY, this.#network);
  }

  async getActiveAddress(): Promise<string> {
    if (!this.#isEnabled) return await this.txManagerService.getFundingWalletAddress();

    return (await this.#findOrRegisterActive()).address;
  }

  async getGranterAddressByWalletId(userWalletId: number): Promise<string> {
    return await this.#granterAddress(() => this.fundingWalletRepository.findGranterOf(userWalletId, this.#network));
  }

  async getGranterAddressByWalletAddress(userWalletAddress: string): Promise<string> {
    return await this.#granterAddress(() => this.fundingWalletRepository.findGranterOfAddress(userWalletAddress, this.#network));
  }

  /** A user wallet that was never granted reads as backed by the active wallet, which is where its first grant will come from. */
  async #granterAddress(findGranter: () => Promise<FundingWalletOutput | undefined>): Promise<string> {
    if (!this.#isEnabled) return await this.txManagerService.getFundingWalletAddress();

    return ((await findGranter()) ?? (await this.#findOrRegisterActive())).address;
  }

  /** Called before a grant is issued, and recorded outside the caller's transaction, because the grant stays on chain when that transaction rolls back. */
  async assignGranterAddress(userWalletId: number): Promise<string> {
    if (!this.#isEnabled) return await this.txManagerService.getFundingWalletAddress();

    const assigned = await this.fundingWalletRepository.findGranterOf(userWalletId, this.#network);
    if (assigned) return assigned.address;

    const active = await this.#findOrRegisterActive();
    await this.txService.outsideTransaction(() =>
      this.fundingWalletRepository.assignUnlessAssigned({ userWalletId, network: this.#network, fundingWalletId: active.id })
    );
    const granter = await this.fundingWalletRepository.findGranterOf(userWalletId, this.#network);

    return (granter ?? active).address;
  }

  async #findOrRegisterActive(): Promise<FundingWalletOutput> {
    return (await this.fundingWalletRepository.findActive(this.#network)) ?? (await this.#registerConfiguredWallet());
  }

  /** Runs in a transaction of its own, so a caller that rolls back cannot undo the registration other callers have already read. */
  async #registerConfiguredWallet(): Promise<FundingWalletOutput> {
    const network = this.#network;
    const address = await this.txManagerService.getFundingWalletAddress();

    return await this.txService.outsideTransaction(() =>
      this.txService.transaction(async () => {
        await this.fundingWalletRepository.lockNetwork(network);

        const active = await this.fundingWalletRepository.findActive(network);
        if (active) return active;

        if (await this.fundingWalletRepository.hasAny(network)) {
          throw createError(503, "No funding wallet is active", { network });
        }

        const registered = await this.fundingWalletRepository.create({ network, address, status: "active" });
        await this.fundingWalletRepository.assignInitializedUserWallets({ network, fundingWalletId: registered.id });

        return registered;
      })
    );
  }
}
