import { AllowanceHttpService, BalanceHttpService, BlockHttpService, DeploymentAllowance } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { InjectSigningClient } from "@src/billing/providers/signing-client.provider";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { MasterSigningClientService, MasterWalletService } from "@src/billing/services";
import { Memoize } from "@src/caching/helpers";
import { InjectSentry, Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";
import { DeploymentConfig, InjectDeploymentConfig } from "@src/deployment/config/config.provider";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { averageBlockCountInAnHour, averageBlockTime } from "@src/utils/constants";

interface Balances {
  denom: string;
  feesLimit: number;
  deploymentLimit: number;
  balance: number;
}

@singleton()
export class TopUpCustodialDeploymentsService {
  private readonly CONCURRENCY = 10;

  private readonly MIN_FEES_AVAILABLE = 5000;

  private readonly logger = new LoggerService({ context: TopUpCustodialDeploymentsService.name });

  constructor(
    private readonly allowanceHttpService: AllowanceHttpService,
    private readonly balanceHttpService: BalanceHttpService,
    private readonly blockHttpService: BlockHttpService,
    @InjectWallet("UAKT_TOP_UP") private readonly uaktMasterWalletService: MasterWalletService,
    @InjectWallet("USDC_TOP_UP") private readonly usdtMasterWalletService: MasterWalletService,
    @InjectSigningClient("UAKT_TOP_UP") private readonly uaktMasterSigningClientService: MasterSigningClientService,
    @InjectSigningClient("USDC_TOP_UP") private readonly usdtMasterSigningClientService: MasterSigningClientService,
    private readonly leaseRepository: LeaseRepository,
    @InjectDeploymentConfig() private readonly config: DeploymentConfig,
    @InjectSentry() private readonly sentry: Sentry,
    private readonly sentryEventService: SentryEventService
  ) {}

  async topUpDeployments() {
    const wallets = [
      { wallet: this.uaktMasterWalletService, client: this.uaktMasterSigningClientService },
      { wallet: this.usdtMasterWalletService, client: this.usdtMasterSigningClientService }
    ];

    const topUpAllCustodialDeployments = wallets.map(async ({ wallet, client }) => {
      const address = await wallet.getFirstAddress();
      await this.allowanceHttpService.paginateDeploymentGrants({ grantee: address, limit: this.CONCURRENCY }, async grants => {
        await Promise.all(
          grants.map(async grant => {
            await this.execWithErrorHandler(grant, () => this.topUpForGrant(grant, client));
          })
        );
      });
    });
    await Promise.all(topUpAllCustodialDeployments);
  }

  private async topUpForGrant(grant: DeploymentAllowance, client: MasterSigningClientService) {
    const owner = grant.granter;

    const balances = await this.collectWalletBalances(grant);
    this.logger.debug({ event: "BALANCES_COLLECTED", granter: owner, grantee: grant.grantee, balances });

    const drainingDeployments = await this.retrieveDrainingDeployments(owner, balances.denom);
    let { deploymentLimit, feesLimit, balance } = balances;

    for (const deployment of drainingDeployments) {
      const topUpAmount = await this.calculateTopUpAmount(deployment);
      if (!this.canTopUp(topUpAmount, { deploymentLimit, feesLimit, balance })) {
        this.logger.debug({ event: "INSUFFICIENT_BALANCE", granter: owner, grantee: grant.grantee, balances: { deploymentLimit, feesLimit, balance } });
        break;
      }
      deploymentLimit -= topUpAmount;
      feesLimit -= this.MIN_FEES_AVAILABLE;
      balance -= topUpAmount + this.MIN_FEES_AVAILABLE;

      await this.topUpDeployment(topUpAmount, deployment, client);
    }
  }

  private async collectWalletBalances(grant: DeploymentAllowance): Promise<Balances> {
    const denom = grant.authorization.spend_limit.denom;
    const deploymentLimit = parseFloat(grant.authorization.spend_limit.amount);

    const feesLimit = await this.retrieveFeesLimit(grant.granter, grant.grantee, denom);
    const { amount } = await this.balanceHttpService.getBalance(grant.granter, denom);
    const balance = parseFloat(amount);

    return {
      denom,
      feesLimit,
      deploymentLimit,
      balance
    };
  }

  private async retrieveFeesLimit(granter: string, grantee: string, denom: string) {
    const feesAllowance = await this.allowanceHttpService.getFeeAllowanceForGranterAndGrantee(granter, grantee);
    const feesSpendLimit = feesAllowance.allowance.spend_limit.find(limit => limit.denom === denom);

    return feesSpendLimit ? parseFloat(feesSpendLimit.amount) : 0;
  }

  private async retrieveDrainingDeployments(owner: string, denom: string): Promise<DrainingDeploymentOutput[]> {
    const currentHeight = await this.getCurrentHeight();
    const closureHeight = currentHeight + averageBlockCountInAnHour * this.config.AUTO_TOP_UP_JOB_INTERVAL_IN_H;

    return await this.leaseRepository.findDrainingLeases({ owner, closureHeight, denom });
  }

  @Memoize({ ttlInSeconds: averageBlockTime })
  private getCurrentHeight() {
    return this.blockHttpService.getCurrentHeight();
  }

  private async calculateTopUpAmount(deployment: DrainingDeploymentOutput): Promise<number> {
    return Math.floor(deployment.blockRate * (averageBlockCountInAnHour * 24 * this.config.AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_DAYS));
  }

  private canTopUp(amount: number, balances: Pick<Balances, "balance" | "deploymentLimit" | "feesLimit">) {
    return balances.deploymentLimit > amount && balances.feesLimit > this.MIN_FEES_AVAILABLE && balances.balance > amount + this.MIN_FEES_AVAILABLE;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async topUpDeployment(amount: number, deployment: DrainingDeploymentOutput, client: MasterSigningClientService) {
    this.logger.debug({ event: "TOPPING_UP_CUSTODIAL_DEPLOYMENT", amount, deployment, warning: "Not implemented yet" });
  }

  private async execWithErrorHandler(grant: DeploymentAllowance, cb: () => Promise<void>) {
    try {
      await cb();
    } catch (error) {
      const sentryEventId = this.sentry.captureEvent(this.sentryEventService.toEvent(error));
      this.logger.error({ event: "TOP_UP_FAILED", error: error.stack, sentryEventId, grant });
    }
  }
}
