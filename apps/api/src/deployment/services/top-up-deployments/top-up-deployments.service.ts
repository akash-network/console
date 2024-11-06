import { AllowanceHttpService, BalanceHttpService, DeploymentAllowance } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { PromisePool } from "@supercharge/promise-pool";
import { singleton } from "tsyringe";

import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { MasterWalletService } from "@src/billing/services";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";

interface Balances {
  denom: string;
  feesLimit: number;
  deploymentLimit: number;
  balance: number;
  isManaged: boolean;
}

@singleton()
export class TopUpDeploymentsService {
  private readonly CONCURRENCY = 10;

  private readonly logger = new LoggerService({ context: TopUpDeploymentsService.name });

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly allowanceHttpService: AllowanceHttpService,
    private readonly balanceHttpService: BalanceHttpService,
    @InjectWallet("MANAGED") private readonly managedMasterWalletService: MasterWalletService,
    @InjectWallet("UAKT_TOP_UP") private readonly uaktMasterWalletService: MasterWalletService,
    @InjectWallet("USDC_TOP_UP") private readonly usdtMasterWalletService: MasterWalletService,
    private readonly leaseRepository: LeaseRepository
  ) {}

  async topUpDeployments() {
    const wallets = [this.uaktMasterWalletService, this.usdtMasterWalletService];

    const topUpAllManagedDeployments = wallets.map(async wallet => {
      const address = await wallet.getFirstAddress();
      await this.allowanceHttpService.paginateDeploymentGrantsForGrantee(address, async grants => {
        await PromisePool.withConcurrency(this.CONCURRENCY)
          .for(grants)
          .process(async grant => this.topUpForGrant(grant));
      });
    });
    await Promise.all(topUpAllManagedDeployments);

    await this.paginateManagedWallets(async userWallets => {
      await Promise.all(userWallets.map(async userWallet => this.topUpForManagedWallet(userWallet)));
    });
  }

  private async topUpForGrant(grant: DeploymentAllowance) {
    const balances = await this.collectCustodialWalletBalances(grant);
    const owner = grant.granter;
    this.logger.debug({ event: "BALANCES_COLLECTED", granter: owner, grantee: grant.grantee, balances });

    const drainingDeployments = await this.retrieveDrainingDeployments(owner);

    drainingDeployments.map(async deployment => {
      const topUpAmount = await this.calculateTopUpAmount(deployment);
      this.validateTopUpAmount(topUpAmount, balances);
    });
  }

  private async collectCustodialWalletBalances(grant: DeploymentAllowance): Promise<Balances> {
    const denom = grant.authorization.spend_limit.denom;
    const deploymentLimit = parseFloat(grant.authorization.spend_limit.amount);

    const feesAllowance = await this.allowanceHttpService.getFeeAllowanceForGranterAndGrantee(grant.granter, grant.grantee);
    const feesSpendLimit = feesAllowance.allowance.spend_limit.find(limit => limit.denom === denom);
    const feesLimit = feesSpendLimit ? parseFloat(feesSpendLimit.amount) : 0;

    const { amount } = await this.balanceHttpService.getBalance(grant.granter, "uakt");
    const balance = parseFloat(amount);

    return {
      denom,
      feesLimit: feesLimit,
      deploymentLimit,
      balance,
      isManaged: false
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async paginateManagedWallets(cb: (page: UserWalletOutput[]) => Promise<void>) {
    this.logger.debug({ event: "PAGINATING_MANAGED_WALLETS", warning: "Not implemented yet" });
  }

  private async topUpForManagedWallet(userWallet: UserWalletOutput) {
    const balances = await this.collectManagedWalletBalances(userWallet);
    this.logger.debug({ event: "BALANCES_COLLECTED", wallet: userWallet, balances });

    const drainingDeployments = await this.retrieveDrainingDeployments(userWallet.address);

    drainingDeployments.map(async deployment => {
      const topUpAmount = await this.calculateTopUpAmount(deployment);
      this.validateTopUpAmount(topUpAmount, balances);
    });
  }

  private async collectManagedWalletBalances(userWallet: UserWalletOutput): Promise<Balances> {
    this.logger.debug({ event: "CALCULATING_MANAGE_WALLET_BALANCES", userWallet, warning: "Not implemented yet" });
    return {
      denom: "usdc",
      feesLimit: 0,
      deploymentLimit: 0,
      balance: 0,
      isManaged: true
    };
  }

  private async retrieveDrainingDeployments(owner: string): Promise<DrainingDeploymentOutput[]> {
    this.logger.debug({ event: "RETRIEVING_DRAINING_DEPLOYMENTS", owner, warning: "Not implemented yet" });
    return [];
  }

  private async calculateTopUpAmount(deployment: DrainingDeploymentOutput): Promise<number> {
    this.logger.debug({ event: "CALCULATING_TOP_UP_AMOUNT", deployment, warning: "Not implemented yet" });
    return 0;
  }

  private validateTopUpAmount(amount: number, balances: Balances) {
    this.logger.debug({ event: "VALIDATING_TOP_UP_AMOUNT", amount, balances, warning: "Not implemented yet" });
  }

  private async topUpCustodialDeployment() {
    this.logger.debug({ event: "TOPPING_UP_CUSTODIAL_DEPLOYMENT", warning: "Not implemented yet" });
  }

  private async topUpManagedDeployment() {
    this.logger.debug({ event: "TOPPING_UP_MANAGED_DEPLOYMENT", warning: "Not implemented yet" });
  }
}
