import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { LoggerService } from "@src/core";

@singleton()
export class RefillService {
  private readonly logger = new LoggerService({ context: RefillService.name });

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly balancesService: BalancesService
  ) {}

  async refillAll() {
    const wallets = await this.userWalletRepository.findDrainingWallets(
      {
        deployment: this.config.DEPLOYMENT_ALLOWANCE_REFILL_THRESHOLD,
        fee: this.config.FEE_ALLOWANCE_REFILL_THRESHOLD
      },
      { limit: this.config.ALLOWANCE_REFILL_BATCH_SIZE }
    );

    if (wallets.length) {
      try {
        await Promise.all(wallets.map(wallet => this.refillWallet(wallet)));
      } catch (error) {
        this.logger.error({ event: "REFILL_ERROR", error });
      } finally {
        await this.refillAll();
      }
    }
  }

  private async refillWallet(wallet: UserWalletOutput) {
    await this.chargeUser(wallet);

    const limits = {
      deployment: this.config.DEPLOYMENT_ALLOWANCE_REFILL_AMOUNT,
      fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
    };

    await this.managedUserWalletService.authorizeSpending({
      address: wallet.address,
      limits
    });

    const limitsUpdate = await this.balancesService.getLimitsUpdate(wallet);

    if (Object.keys(limitsUpdate).length > 0) {
      limitsUpdate.isTrialing = false;
      await this.userWalletRepository.updateById(wallet.id, limitsUpdate);
    }
  }

  private async chargeUser(wallet: UserWalletOutput) {
    this.logger.debug({ event: "CHARGE_USER", wallet });
  }
}
