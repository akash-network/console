import { AuthzHttpService, DeploymentHttpService, DeploymentInfo } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import { Wallet } from "@src/billing/lib/wallet/wallet";
import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletInput, UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";

@singleton()
export class BalancesService {
  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    @InjectWallet("MANAGED") private readonly masterWallet: Wallet,
    private readonly authzHttpService: AuthzHttpService,
    private readonly deploymentHttpService: DeploymentHttpService
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

  async getFreshLimits(userWallet: Pick<UserWalletOutput, "address">): Promise<{ fee: number; deployment: number }> {
    const [fee, deployment] = await Promise.all([this.retrieveAndCalcFeeLimit(userWallet), this.retrieveDeploymentLimit(userWallet)]);
    return { fee, deployment };
  }

  private async retrieveAndCalcFeeLimit(userWallet: Pick<UserWalletOutput, "address">): Promise<number> {
    const masterWalletAddress = await this.masterWallet.getFirstAddress();
    const feeAllowance = await this.authzHttpService.getFeeAllowanceForGranterAndGrantee(masterWalletAddress, userWallet.address);

    if (!feeAllowance) {
      return 0;
    }

    return feeAllowance.allowance.spend_limit.reduce((acc, { denom, amount }) => (denom === "uakt" ? acc + parseInt(amount) : acc), 0);
  }

  async retrieveDeploymentLimit(userWallet: Pick<UserWalletOutput, "address">): Promise<number> {
    const masterWalletAddress = await this.masterWallet.getFirstAddress();
    const depositDeploymentGrant = await this.authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee(masterWalletAddress, userWallet.address);

    if (!depositDeploymentGrant || depositDeploymentGrant.authorization.spend_limit.denom !== this.config.DEPLOYMENT_GRANT_DENOM) {
      return 0;
    }

    return parseInt(depositDeploymentGrant.authorization.spend_limit.amount);
  }

  /**
   * Calculate the total escrow balance for all active deployments of a user
   * @param address User wallet address
   * @returns Total escrow balance
   */
  async calculateDeploymentEscrowBalance(address: string): Promise<number> {
    const activeDeploymentsResponse = await this.deploymentHttpService.loadDeploymentList(address, "active");
    const activeDeployments = activeDeploymentsResponse.deployments;

    const deploymentEscrowBalance = activeDeployments.reduce((total: number, deployment: DeploymentInfo) => {
      const escrowAccount = deployment.escrow_account;
      if (!escrowAccount) return total;

      if (escrowAccount.balance && escrowAccount.balance.amount) {
        total += parseFloat(escrowAccount.balance.amount);
      }

      if (escrowAccount.funds && escrowAccount.funds.amount) {
        total += parseFloat(escrowAccount.funds.amount);
      }

      return total;
    }, 0);

    return deploymentEscrowBalance;
  }
}
