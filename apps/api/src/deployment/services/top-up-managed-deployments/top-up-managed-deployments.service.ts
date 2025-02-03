import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { DepositDeploymentMsgOptions, RpcMessageService, Wallet } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { TopUpSummarizer } from "@src/deployment/lib/top-up-summarizer/top-up-summarizer";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { DeploymentsRefiller, TopUpDeploymentsOptions } from "@src/deployment/types/deployments-refiller";
import { CachedBalanceService } from "../cached-balance/cached-balance.service";

@singleton()
export class TopUpManagedDeploymentsService implements DeploymentsRefiller {
  private readonly logger = LoggerService.forContext(TopUpManagedDeploymentsService.name);

  constructor(
    private readonly managedSignerService: ManagedSignerService,
    private readonly billingConfig: BillingConfigService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    @InjectWallet("MANAGED") private readonly managedMasterWallet: Wallet,
    private readonly rpcClientService: RpcMessageService,
    private readonly cachedBalanceService: CachedBalanceService,
    private readonly blockHttpService: BlockHttpService
  ) {}

  async topUpDeployments(options: TopUpDeploymentsOptions): Promise<void> {
    const summarizer = new TopUpSummarizer();
    const depositor = await this.managedMasterWallet.getFirstAddress();
    const denom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");

    const startBlockHeight = await this.blockHttpService.getCurrentHeight();
    summarizer.set("startBlockHeight", startBlockHeight);

    await this.drainingDeploymentService.paginate({ limit: options.concurrency || 10 }, async deployments => {
      await Promise.all(
        deployments.map(async deployment => {
          summarizer.inc("deploymentCount");
          summarizer.trackWallet(deployment.address);
          let messageInput: DepositDeploymentMsgOptions;
          try {
            const { address, predictedClosedHeight } = deployment;
            summarizer.ensurePredictedClosedHeight(predictedClosedHeight);

            const balance = await this.cachedBalanceService.get(address);
            const desiredAmount = await this.drainingDeploymentService.calculateTopUpAmount(deployment);
            const sufficientAmount = balance.reserveSufficientAmount(desiredAmount);

            messageInput = { dseq: Number(deployment.dseq), amount: sufficientAmount, denom, owner: deployment.address, depositor };
            const message = this.rpcClientService.getDepositDeploymentMsg(messageInput);

            if (!options.dryRun) {
              await this.managedSignerService.executeManagedTx(deployment.walletId, [message]);
              summarizer.inc("deploymentTopUpCount");
              summarizer.addTopUpAmount(sufficientAmount);
              summarizer.trackSuccessfulWallet(deployment.address);
            }
            this.logger.info({ event: "TOP_UP_DEPLOYMENT_SUCCESS", deployment, params: messageInput, dryRun: options.dryRun });
          } catch (error) {
            this.logger.error({
              event: "TOP_UP_DEPLOYMENT_ERROR",
              deployment,
              message: error.message,
              stack: error.stack,
              params: messageInput,
              dryRun: options.dryRun
            });
            summarizer.inc("deploymentTopUpErrorCount");
            summarizer.trackFailedWallet(deployment.address);

            if (error.message.startsWith("Insufficient balance")) {
              summarizer.inc("insufficientBalanceCount");
            }
          }
        })
      );
    });

    const endBlockHeight = await this.blockHttpService.getCurrentHeight();
    summarizer.set("endBlockHeight", endBlockHeight);

    const summary = summarizer.summarize();
    this.logger.info({ event: "TOP_UP_DEPLOYMENTS_SUMMARY", summary, dryRun: options.dryRun });
  }
}
