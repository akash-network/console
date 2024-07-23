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

  async updateUserWalletLimits(userWallet: UserWalletOutput) {
    const [feeLimit, deploymentLimit] = await Promise.all([this.calculateFeeLimit(userWallet), this.calculateDeploymentLimit(userWallet)]);

    const update: Partial<UserWalletInput> = {};

    const feeLimitStr = feeLimit.toString();

    if (userWallet.feeAllowance !== feeLimitStr) {
      update.feeAllowance = feeLimitStr;
    }

    const deploymentLimitStr = deploymentLimit.toString();

    if (userWallet.deploymentAllowance !== deploymentLimitStr) {
      update.deploymentAllowance = deploymentLimitStr;
    }

    if (Object.keys(update).length > 0) {
      await this.userWalletRepository.updateById(userWallet.id, update);
    }
  }

  private async calculateFeeLimit(userWallet: UserWalletOutput) {
    const feeAllowance = await this.allowanceHttpService.getFeeAllowancesForGrantee(userWallet.address);
    const masterWalletAddress = await this.masterWalletService.getFirstAddress();

    return feeAllowance.reduce((acc, allowance) => {
      if (allowance.granter !== masterWalletAddress) {
        return acc;
      }

      return allowance.allowance.spend_limit.reduce((acc, { denom, amount }) => {
        if (denom !== this.config.TRIAL_ALLOWANCE_DENOM) {
          return acc;
        }

        return acc + parseInt(amount);
      }, 0);
    }, 0);
  }

  private async calculateDeploymentLimit(userWallet: UserWalletOutput) {
    const deploymentAllowance = await this.allowanceHttpService.getDeploymentAllowancesForGrantee(userWallet.address);
    const masterWalletAddress = await this.masterWalletService.getFirstAddress();

    return deploymentAllowance.reduce((acc, allowance) => {
      if (allowance.granter !== masterWalletAddress || allowance.authorization.spend_limit.denom !== this.config.TRIAL_ALLOWANCE_DENOM) {
        return acc;
      }

      return acc + parseInt(allowance.authorization.spend_limit.amount);
    }, 0);
  }
}
