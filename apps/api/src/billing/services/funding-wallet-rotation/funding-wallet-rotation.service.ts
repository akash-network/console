import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { type FundingWalletOutput, FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

export type FundingWalletPromotion = { active: FundingWalletOutput; draining: FundingWalletOutput };

/** Changes which funding wallet a network issues new grants from, one step at a time, so a wallet can be replaced while its users keep their balances. */
@singleton()
export class FundingWalletRotationService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly fundingWalletRepository: FundingWalletRepository,
    private readonly fundingWalletRegistry: FundingWalletRegistryService,
    private readonly coreConfigService: CoreConfigService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FundingWalletRotationService.name });
  }

  get #network() {
    return this.coreConfigService.get("NETWORK");
  }

  /** Records a wallet the signer already holds the key of, so promoting it later needs no deploy in between. */
  async addStandby(address: string): Promise<FundingWalletOutput> {
    this.#assertRegistryIsOn();
    const network = this.#network;

    const standby = await this.txService.transaction(async () => {
      await this.fundingWalletRepository.lockNetwork(network);
      await this.fundingWalletRegistry.findOrRegisterActive();
      const known = await this.fundingWalletRepository.findByAddress(network, address);

      if (known?.status === "standby") return known;
      if (known) throw createError(409, `Funding wallet ${address} is already ${known.status}`, { network });

      return await this.fundingWalletRepository.create({ network, address, status: "standby" });
    });

    this.#logger.info({ event: "FUNDING_WALLET_STANDBY_ADDED", network, address });

    return standby;
  }

  /** Makes a standby wallet the one new grants come from; the wallet it replaces keeps backing its users until each of them is moved. */
  async promote(address: string): Promise<FundingWalletPromotion> {
    this.#assertRegistryIsOn();
    const network = this.#network;

    const promotion = await this.txService.transaction(async () => {
      await this.fundingWalletRepository.lockNetwork(network);
      const standby = await this.fundingWalletRepository.findByAddress(network, address);

      if (standby?.status !== "standby") {
        throw createError(409, `Funding wallet ${address} is ${standby?.status ?? "not registered"}, and only a standby wallet can be promoted`, { network });
      }

      await this.#assertNoWalletIsDraining(network);

      const replaced = await this.fundingWalletRegistry.findOrRegisterActive();
      const draining = await this.fundingWalletRepository.updateStatus(replaced.id, "draining");
      const active = await this.fundingWalletRepository.updateStatus(standby.id, "active");

      return { active: active!, draining: draining! };
    });

    this.#logger.info({ event: "FUNDING_WALLET_PROMOTED", network, active: promotion.active.address, draining: promotion.draining.address });

    return promotion;
  }

  /** One wallet drains at a time, so every user who is not on the active wallet is on the same other one. */
  async #assertNoWalletIsDraining(network: string): Promise<void> {
    const [draining] = await this.fundingWalletRepository.findByStatus(network, "draining");

    if (draining) {
      throw createError(409, `Funding wallet ${draining.address} is still draining`, { network });
    }
  }

  #assertRegistryIsOn(): void {
    if (!this.fundingWalletRegistry.isEnabled) {
      throw createError(409, "The funding wallet registry is switched off on this network", { network: this.#network });
    }
  }
}
