import { AllowanceHttpService } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletInput, UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { MasterWalletService } from "@src/billing/services";

@singleton()
export class BalancesService {
  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly masterWalletService: MasterWalletService,
    private readonly allowanceHttpService: AllowanceHttpService
  ) {}

  async refreshUserWalletLimits(userWallet: UserWalletOutput, options?: { endTrial: boolean }): Promise<void> {
    const update = await this.getFreshLimitsUpdate(userWallet);

    if (!Object.keys(update).length) {
      return;
    }

    if (options?.endTrial && userWallet.isTrialing) {
      update.isTrialing = false;
    }

    await this.userWalletRepository.updateById(userWallet.id, update);
  }

  async getFreshLimitsUpdate(userWallet: UserWalletOutput): Promise<Partial<UserWalletInput>> {
    const limits = await this.getFreshLimits(userWallet);
    const update: Partial<UserWalletInput> = {};

    if (userWallet.feeAllowance !== limits.fee) {
      update.feeAllowance = limits.fee;
    }

    if (userWallet.deploymentAllowance !== limits.deployment) {
      update.deploymentAllowance = limits.deployment;
    }

    return update;
  }

  async getFreshLimits(userWallet: UserWalletOutput): Promise<{ fee: number; deployment: number }> {
    const [fee, deployment] = await Promise.all([this.calculateFeeLimit(userWallet), this.calculateDeploymentLimit(userWallet)]);
    return { fee, deployment };
  }

  private async calculateFeeLimit(userWallet: UserWalletOutput): Promise<number> {
    const feeAllowance = await this.allowanceHttpService.getFeeAllowancesForGrantee(userWallet.address);
    const masterWalletAddress = await this.masterWalletService.getFirstAddress();

    return feeAllowance.reduce((acc, allowance) => {
      if (allowance.granter !== masterWalletAddress) {
        return acc;
      }

      return allowance.allowance.spend_limit.reduce((acc, { denom, amount }) => {
        if (denom !== "uakt") {
          return acc;
        }

        return acc + parseInt(amount);
      }, 0);
    }, 0);
  }

  async calculateDeploymentLimit(userWallet: UserWalletOutput): Promise<number> {
    const deploymentAllowance = await this.allowanceHttpService.getDeploymentAllowancesForGrantee(userWallet.address);
    const masterWalletAddress = await this.masterWalletService.getFirstAddress();

    return deploymentAllowance.reduce((acc, allowance) => {
      if (allowance.granter !== masterWalletAddress || allowance.authorization.spend_limit.denom !== this.config.DEPLOYMENT_GRANT_DENOM) {
        return acc;
      }

      return acc + parseInt(allowance.authorization.spend_limit.amount);
    }, 0);
  }
}
