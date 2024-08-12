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

  async updateUserWalletLimits(userWallet: UserWalletOutput): Promise<void> {
    const update = await this.getLimitsUpdate(userWallet);

    if (Object.keys(update).length > 0) {
      await this.userWalletRepository.updateById(userWallet.id, update);
    }
  }

  async getLimitsUpdate(userWallet: UserWalletOutput): Promise<Partial<UserWalletInput>> {
    const [feeLimit, deploymentLimit] = await Promise.all([this.calculateFeeLimit(userWallet), this.calculateDeploymentLimit(userWallet)]);

    const update: Partial<UserWalletInput> = {};

    const feeLimitStr = feeLimit;

    if (userWallet.feeAllowance !== feeLimitStr) {
      update.feeAllowance = feeLimitStr;
    }

    if (userWallet.deploymentAllowance !== deploymentLimit) {
      update.deploymentAllowance = deploymentLimit;
    }

    return update;
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

  private async calculateDeploymentLimit(userWallet: UserWalletOutput): Promise<number> {
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
