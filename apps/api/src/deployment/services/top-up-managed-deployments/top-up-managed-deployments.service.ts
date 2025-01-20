import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService, Wallet } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { InjectSentry, Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";
import { TopUpSummarizer } from "@src/deployment/lib/top-up-summarizer/top-up-summarizer";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { DeploymentsRefiller, TopUpDeploymentsOptions } from "@src/deployment/types/deployments-refiller";

@singleton()
export class TopUpManagedDeploymentsService implements DeploymentsRefiller {
  private readonly logger = LoggerService.forContext(TopUpManagedDeploymentsService.name);

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedSignerService: ManagedSignerService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    @InjectWallet("MANAGED") private readonly managedMasterWallet: Wallet,
    private readonly balancesService: BalancesService,
    private readonly rpcClientService: RpcMessageService,
    private readonly blockHttpService: BlockHttpService,
    @InjectSentry() private readonly sentry: Sentry,
    private readonly sentryEventService: SentryEventService
  ) {}

  async topUpDeployments(options: TopUpDeploymentsOptions) {
    const summarizer = new TopUpSummarizer();
    summarizer.set("startBlockHeight", await this.blockHttpService.getCurrentHeight());

    await this.userWalletRepository.paginate({ limit: options.concurrency || 10 }, async wallets => {
      await Promise.all(wallets.map(async wallet => this.topUpForWallet(wallet, options, summarizer)));
    });

    summarizer.set("endBlockHeight", await this.blockHttpService.getCurrentHeight());
    const summary = summarizer.summarize();
    this.logger.info({ event: "TOP_UP_SUMMARY", summary, dryRun: options.dryRun });

    if (summary.walletsTopUpErrorCount || summary.deploymentTopUpErrorCount) {
      const eventId = this.sentry.captureEvent(this.sentryEventService.toEvent({ message: "Top up deployments error", summary }));
      this.logger.debug({ event: "SENTRY_EVENT_REPORTED", eventId });
    }
  }

  private async topUpForWallet(wallet: UserWalletOutput, options: TopUpDeploymentsOptions, summary: TopUpSummarizer) {
    const depositor = await this.managedMasterWallet.getFirstAddress();
    summary.inc("walletsCount");
    const owner = wallet.address;
    const denom = this.billingConfig.DEPLOYMENT_GRANT_DENOM;
    const drainingDeployments = await this.drainingDeploymentService.findDeployments(owner, denom);
    summary.inc("deploymentCount", drainingDeployments.length);

    if (!drainingDeployments.length) {
      return;
    }

    let balance = await this.balancesService.retrieveDeploymentLimit(wallet);
    let hasTopUp = false;
    let hasError = false;

    for (const deployment of drainingDeployments) {
      let amount = await this.drainingDeploymentService.calculateTopUpAmount(deployment);
      amount = Math.min(amount, balance);

      if (amount <= 0) {
        this.logger.info({ event: "INSUFFICIENT_BALANCE", owner, balance, amount });
        summary.inc("insufficientBalanceCount");
        break;
      }
      balance -= amount;
      const messageInput = { dseq: deployment.dseq, amount, denom, owner, depositor };
      const message = this.rpcClientService.getDepositDeploymentMsg(messageInput);

      if (!options.dryRun) {
        try {
          await this.managedSignerService.executeManagedTx(wallet.id, [message]);
          this.logger.info({ event: "TOP_UP_SUCCESS", params: messageInput, dryRun: options.dryRun });
        } catch (error) {
          summary.inc("deploymentTopUpErrorCount");
          this.logger.error({ event: "TOP_UP_Error", params: messageInput, dryRun: options.dryRun });
          hasError = true;
        }
      }

      hasTopUp = true;
      summary.inc("deploymentTopUpCount");
      summary.ensurePredictedClosedHeight(deployment.predictedClosedHeight);
    }

    if (hasTopUp) {
      summary.inc("walletsTopUpCount");
    }

    if (hasError) {
      summary.inc("walletsTopUpErrorCount");
    }
  }
}
