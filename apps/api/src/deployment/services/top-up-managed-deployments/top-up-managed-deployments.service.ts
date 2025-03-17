import { LoggerService } from "@akashnetwork/logging";
import groupBy from "lodash/groupBy";
import { singleton } from "tsyringe";

import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { DepositDeploymentMsg, DepositDeploymentMsgOptions, RpcMessageService, Wallet } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { TopUpSummarizer } from "@src/deployment/lib/top-up-summarizer/top-up-summarizer";
import { DrainingDeployment } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { DeploymentsRefiller, TopUpDeploymentsOptions } from "@src/deployment/types/deployments-refiller";
import { CachedBalanceService } from "../cached-balance/cached-balance.service";

type CollectedMessage = {
  message: DepositDeploymentMsg;
  input: DepositDeploymentMsgOptions;
  deployment: DrainingDeployment;
};

@singleton()
export class TopUpManagedDeploymentsService implements DeploymentsRefiller {
  private readonly logger = LoggerService.forContext(TopUpManagedDeploymentsService.name);

  private readonly summarizer = new TopUpSummarizer();

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
    const startBlockHeight = await this.blockHttpService.getCurrentHeight();
    this.summarizer.set("startBlockHeight", startBlockHeight);

    await this.drainingDeploymentService.paginate({ limit: options.concurrency || 10 }, async deployments => {
      const messageInputs = await this.collectMessages(deployments, options);
      const byOwner = groupBy(messageInputs, "deployment.address");
      await Promise.all(Object.values(byOwner).map(ownerInputs => this.topUpForOwner(ownerInputs, options)));
    });

    const endBlockHeight = await this.blockHttpService.getCurrentHeight();
    this.summarizer.set("endBlockHeight", endBlockHeight);

    this.logSummary(options);
  }

  private async collectMessages(deployments: DrainingDeployment[], options: TopUpDeploymentsOptions): Promise<CollectedMessage[]> {
    const depositor = await this.managedMasterWallet.getFirstAddress();
    const denom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");

    const messageInputs = await Promise.all(
      deployments.map(async deployment => {
        this.summarizer.inc("deploymentCount");
        this.summarizer.trackWallet(deployment.address);

        try {
          const { address, predictedClosedHeight } = deployment;
          this.summarizer.ensurePredictedClosedHeight(predictedClosedHeight);

          const [balance, desiredAmount] = await Promise.all([
            this.cachedBalanceService.get(address),
            this.drainingDeploymentService.calculateTopUpAmount(deployment)
          ]);
          const sufficientAmount = balance.reserveSufficientAmount(desiredAmount);

          const messageInput: DepositDeploymentMsgOptions = {
            dseq: Number(deployment.dseq),
            amount: sufficientAmount,
            denom,
            owner: deployment.address,
            depositor
          };

          const message = this.rpcClientService.getDepositDeploymentMsg(messageInput);

          return {
            message,
            input: messageInput,
            deployment
          };
        } catch (error) {
          this.logger.error({
            event: "MESSAGE_PREPARATION_ERROR",
            deployment,
            message: error.message,
            stack: error.stack,
            dryRun: options.dryRun
          });

          this.summarizer.inc("deploymentTopUpErrorCount");
          this.summarizer.trackFailedWallet(deployment.address);

          if (error.message.startsWith("Insufficient balance")) {
            this.summarizer.inc("insufficientBalanceCount");
          }

          return;
        }
      })
    );

    return messageInputs.filter(Boolean);
  }

  private async topUpForOwner(ownerInputs: CollectedMessage[], options: TopUpDeploymentsOptions) {
    const owner = ownerInputs[0].deployment.address;
    const logItems = ownerInputs.map(({ deployment, input }) => ({
      deployment,
      input
    }));
    const walletId = ownerInputs[0].deployment.walletId;

    try {
      if (!options.dryRun) {
        await this.managedSignerService.executeManagedTx(
          walletId,
          ownerInputs.map(i => i.message)
        );
      }

      this.summarizer.inc("deploymentTopUpCount", ownerInputs.length);
      ownerInputs.forEach(i => this.summarizer.addTopUpAmount(i.input.amount));
      this.summarizer.trackSuccessfulWallet(owner);

      this.logger.info({
        event: "TOP_UP_DEPLOYMENTS_SUCCESS",
        owner,
        items: logItems,
        dryRun: options.dryRun
      });
    } catch (error) {
      this.logger.error({
        event: "TOP_UP_DEPLOYMENTS_ERROR",
        owner,
        items: logItems,
        message: error.message,
        stack: error.stack,
        dryRun: options.dryRun
      });
      this.summarizer.inc("deploymentTopUpErrorCount", ownerInputs.length);
      this.summarizer.trackFailedWallet(owner);
    }
  }

  private logSummary(options: TopUpDeploymentsOptions) {
    const summary = this.summarizer.summarize();
    const log = { event: "TOP_UP_DEPLOYMENTS_SUMMARY", summary, dryRun: options.dryRun };
    const hasErrors = summary.deploymentTopUpErrorCount - summary.insufficientBalanceCount > 0;

    if (hasErrors) {
      this.logger.error(log);
    } else {
      this.logger.info(log);
    }
  }
}
