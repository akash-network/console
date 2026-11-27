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
  get isEnabled() {
    return this.featureFlagsService.isEnabledForSubject(FeatureFlags.FUNDING_WALLET_REGISTRY, this.#network);
  }

  async getActiveAddress(): Promise<string> {
    if (!this.isEnabled) return await this.txManagerService.getFundingWalletAddress();

    return await this.#activeAddress();
  }

  async getGranterAddressByWalletId(userWalletId: number): Promise<string> {
    return await this.#granterAddress(() => this.fundingWalletRepository.findGranterOf(userWalletId, this.#network));
  }

  async getGranterAddressByWalletAddress(userWalletAddress: string): Promise<string> {
    return await this.#granterAddress(() => this.fundingWalletRepository.findGranterOfAddress(userWalletAddress, this.#network));
  }

  /** A user wallet that was never granted reads as backed by the active wallet, which is where its first grant will come from. */
  async #granterAddress(findGranter: () => Promise<FundingWalletOutput | undefined>): Promise<string> {
    if (!this.isEnabled) return await this.txManagerService.getFundingWalletAddress();

    const granter = await findGranter();

    return granter ? granter.address : await this.#activeAddress();
  }

  /** Reads register nothing: until a first grant registers it, the configured wallet is the only funding wallet the network has. */
  async #activeAddress(): Promise<string> {
    const registered = await this.fundingWalletRepository.findActiveOrAny(this.#network);

    return registered ? this.#assertActive(registered).address : await this.txManagerService.getFundingWalletAddress();
  }

  /** A network that has funding wallets but no active one is mid-rotation, where falling back to the configured wallet could grant from a wallet being emptied. */
  #assertActive(wallet: FundingWalletOutput): FundingWalletOutput {
    if (wallet.status !== "active") {
      throw createError(503, "No funding wallet is active", { network: this.#network });
    }

    return wallet;
  }

  /** Called before a grant is issued, and written on the caller's own connection: leasing a second one while a transaction holds the first can leave every pooled connection waiting on another. */
  async assignGranterAddress(userWalletId: number): Promise<string> {
    if (!this.isEnabled) return await this.txManagerService.getFundingWalletAddress();

    const assigned = await this.fundingWalletRepository.findGranterOf(userWalletId, this.#network);
    if (assigned) return assigned.address;

    const active = await this.findOrRegisterActive();
    await this.fundingWalletRepository.assignUnlessAssigned({ userWalletId, network: this.#network, fundingWalletId: active.id });
    const granter = await this.fundingWalletRepository.findGranterOf(userWalletId, this.#network);

    return (granter ?? active).address;
  }

  /** Registers the configured wallet as active when the network has no funding wallet yet. */
  async findOrRegisterActive(): Promise<FundingWalletOutput> {
    return (await this.fundingWalletRepository.findActive(this.#network)) ?? (await this.#registerConfiguredWallet());
  }

  /** Joins the caller's transaction when there is one, so the registration commits or rolls back with the grant record it was made for. */
  async #registerConfiguredWallet(): Promise<FundingWalletOutput> {
    const network = this.#network;
    const address = await this.txManagerService.getFundingWalletAddress();

    return await this.txService.transaction(async () => {
      await this.fundingWalletRepository.lockNetwork(network);

      const known = await this.fundingWalletRepository.findActiveOrAny(network);
      if (known) return this.#assertActive(known);

      const registered = await this.fundingWalletRepository.create({ network, address, status: "active" });
      await this.fundingWalletRepository.assignInitializedUserWallets({ network, fundingWalletId: registered.id });

      return registered;
    });
  }
}
