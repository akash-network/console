import { AuthzHttpService, DeploymentHttpService, DeploymentInfo } from "@akashnetwork/http-sdk";
import { singleton } from "tsyringe";

import type { GetBalancesResponseOutput } from "@src/billing/http-schemas/balance.schema";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type UserWalletOutput } from "@src/billing/repositories";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { Memoize } from "@src/caching/helpers";
import { StatsService } from "@src/dashboard/services/stats/stats.service";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class BalancesService {
  #currencyFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false
  });

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private txManagerService: TxManagerService,
    private readonly authzHttpService: AuthzHttpService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly statsService: StatsService
  ) {}

  async getFreshLimits(userWallet: Pick<UserWalletOutput, "address" | "isOldWallet">): Promise<{ fee: number; deployment: number }> {
    const [fee, deployment] = await Promise.all([this.retrieveAndCalcFeeLimit(userWallet), this.retrieveDeploymentLimit(userWallet)]);
    return { fee, deployment };
  }

  async retrieveAndCalcFeeLimit(userWallet: Pick<UserWalletOutput, "address" | "isOldWallet">): Promise<number> {
    const fundingWalletAddress = await this.txManagerService.getFundingWalletAddress(userWallet.isOldWallet ?? false);
    const feeAllowance = await this.authzHttpService.getFeeAllowanceForGranterAndGrantee(fundingWalletAddress, userWallet.address!);

    if (!feeAllowance) {
      return 0;
    }

    return feeAllowance.allowance.spend_limit.reduce((acc, { denom, amount }) => (denom === "uakt" ? acc + parseInt(amount) : acc), 0);
  }

  async retrieveDeploymentLimit(userWallet: Pick<UserWalletOutput, "address" | "isOldWallet">): Promise<number> {
    const fundingWalletAddress = await this.txManagerService.getFundingWalletAddress(userWallet.isOldWallet ?? false);
    const depositDeploymentGrant = await this.authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee(fundingWalletAddress, userWallet.address!);

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
    const activeDeploymentsResponse = await this.deploymentHttpService.findAll({ owner: address, state: "active" });
    const activeDeployments = activeDeploymentsResponse.deployments;

    return activeDeployments.reduce((total: number, deployment: DeploymentInfo) => {
      const escrowAccount = deployment.escrow_account;
      if (!escrowAccount) return total;

      return total + parseFloat(escrowAccount.state.funds.reduce((sum, { amount }) => sum + parseFloat(amount), 0).toFixed(18));
    }, 0);
  }

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getFullBalanceMemoized(address: string, isOldWallet: boolean = false): Promise<GetBalancesResponseOutput> {
    return this.getFullBalance(address, isOldWallet);
  }

  async getFullBalance(address: string, isOldWallet: boolean = false): Promise<GetBalancesResponseOutput> {
    const [balanceData, deploymentEscrowBalance] = await Promise.all([
      this.getFreshLimits({ address, isOldWallet }),
      this.calculateDeploymentEscrowBalance(address)
    ]);

    return {
      data: {
        balance: balanceData.deployment,
        deployments: deploymentEscrowBalance,
        total: balanceData.deployment + deploymentEscrowBalance
      }
    };
  }

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getFullBalanceInFiatMemoized(address: string, isOldWallet: boolean = false): Promise<GetBalancesResponseOutput["data"]> {
    return this.getFullBalanceInFiat(address, isOldWallet);
  }

  async getFullBalanceInFiat(address: string, isOldWallet: boolean = false): Promise<GetBalancesResponseOutput["data"]> {
    const { data } = await this.getFullBalance(address, isOldWallet);

    const balance = await this.toFiatAmount(data.balance);
    const deployments = await this.toFiatAmount(data.deployments);
    const total = this.ensure2floatingDigits(balance + deployments);

    return { balance, deployments, total };
  }

  async toFiatAmount(uTokenAmount: number) {
    return this.ensure2floatingDigits(await this.#convertToFiatAmount(uTokenAmount / 1_000_000));
  }

  async #convertToFiatAmount(amount: number): Promise<number> {
    const coin = this.config.DEPLOYMENT_GRANT_DENOM === "uakt" ? "akash-network" : "usd-coin";
    return await this.statsService.convertToFiatAmount(amount, coin);
  }

  ensure2floatingDigits(amount: number) {
    return Number(this.#currencyFormatter.format(amount));
  }
}
