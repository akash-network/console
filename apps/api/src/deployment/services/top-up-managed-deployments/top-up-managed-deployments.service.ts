import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService, Wallet } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { ErrorService } from "@src/core/services/error/error.service";
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
    private readonly errorService: ErrorService
  ) {}

  async topUpDeployments(options: TopUpDeploymentsOptions) {
    const summary = new TopUpSummarizer();
    summary.set("startBlockHeight", await this.blockHttpService.getCurrentHeight());

    await this.userWalletRepository.paginate({ limit: options.concurrency || 10 }, async wallets => {
      await Promise.all(
        wallets.map(async wallet => {
          await this.errorService.execWithErrorHandler(
            { wallet, event: "TOP_UP_ERROR" },
            () => this.topUpForWallet(wallet, options, summary),
            () => summary.inc("walletsTopUpErrorCount")
          );
        })
      );
    });

    summary.set("endBlockHeight", await this.blockHttpService.getCurrentHeight());
    this.logger.info({ context: TopUpManagedDeploymentsService.name, event: "TOP_UP_SUMMARY", summary: summary.summarize(), dryRun: options.dryRun });
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
      this.logger.info({ event: "TOP_UP_DEPLOYMENT", params: messageInput, dryRun: options.dryRun });

      if (!options.dryRun) {
        await this.managedSignerService.executeManagedTx(wallet.id, [message]);
        this.logger.info({ event: "TOP_UP_SUCCESS" });
      }

      hasTopUp = true;
      summary.inc("deploymentTopUpCount");
      summary.ensurePredictedClosedHeight(deployment.predictedClosedHeight);
    }

    if (hasTopUp) {
      summary.inc("walletsTopUpCount");
    }
  }
}
