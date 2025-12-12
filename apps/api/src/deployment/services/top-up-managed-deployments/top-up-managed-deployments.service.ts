import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { DepositDeploymentMsgOptions, RpcMessageService } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { LoggerService } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { TopUpSummarizer } from "@src/deployment/lib/top-up-summarizer/top-up-summarizer";
import { DrainingDeployment } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { CachedBalanceService } from "../cached-balance/cached-balance.service";

type CollectedMessage = {
  message: { typeUrl: string; value: MsgAccountDeposit };
  input: DepositDeploymentMsgOptions;
  deployment: DrainingDeployment;
};

@singleton()
export class TopUpManagedDeploymentsService {
  private readonly summarizer = new TopUpSummarizer();

  constructor(
    private readonly managedSignerService: ManagedSignerService,
    private readonly billingConfig: BillingConfigService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly rpcClientService: RpcMessageService,
    private readonly cachedBalanceService: CachedBalanceService,
    private readonly blockHttpService: BlockHttpService,
    private readonly chainErrorService: ChainErrorService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(TopUpManagedDeploymentsService.name);
  }

  async topUpDeployments(options: DryRunOptions): Promise<Result<void, unknown[]>> {
    const startBlockHeight = await this.blockHttpService.getCurrentHeight();
    this.summarizer.set("startBlockHeight", startBlockHeight);
    const errors: unknown[] = [];

    for await (const { address, deployments } of this.drainingDeploymentService.findDrainingDeploymentsByOwner()) {
      try {
        const messageInputs = await this.collectMessages(deployments, options);
        if (!messageInputs.length) {
          this.logger.info({
            event: "TOP_UP_SKIPPED_NOTHING_TO_TOP_UP",
            owner: address,
            deploymentCount: deployments.length,
            dryRun: options.dryRun
          });
          continue;
        }
        await this.topUpForOwner(address, messageInputs, options);
      } catch (error: unknown) {
        errors.push(error);
      }
    }

    await this.finalizeSummary(options);

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  private async finalizeSummary(options: DryRunOptions) {
    const endBlockHeight = await this.blockHttpService.getCurrentHeight();
    this.summarizer.set("endBlockHeight", endBlockHeight);

    this.logSummary(options);
  }

  private async collectMessages(deployments: DrainingDeployment[], options: DryRunOptions): Promise<CollectedMessage[]> {
    const denom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");

    const messageInputs = await Promise.all(
      deployments.map(async deployment => {
        this.summarizer.inc("deploymentCount");
        this.summarizer.trackWallet(deployment.address);

        try {
          const { address, predictedClosedHeight } = deployment;
          this.summarizer.ensurePredictedClosedHeight(predictedClosedHeight);

          const [balance, desiredAmount] = await Promise.all([
            this.cachedBalanceService.get(address, deployment.isOldWallet ?? false),
            this.drainingDeploymentService.calculateTopUpAmount(deployment)
          ]);
          if (desiredAmount <= 0) {
            this.logger.warn({
              event: "TOP_UP_AMOUNT_NON_POSITIVE",
              desiredAmount,
              dseq: deployment.dseq,
              address: deployment.address,
              blockRate: deployment.blockRate
            });
          }
          const sufficientAmount = balance.reserveSufficientAmount(desiredAmount);

          const messageInput: DepositDeploymentMsgOptions = {
            dseq: Number(deployment.dseq),
            amount: sufficientAmount,
            denom,
            owner: deployment.address,
            signer: deployment.address
          };

          const message = this.rpcClientService.getDepositDeploymentMsg(messageInput);

          return {
            message,
            input: messageInput,
            deployment
          };
        } catch (error: any) {
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

    return messageInputs.filter(x => !!x);
  }

  private async topUpForOwner(owner: string, ownerInputs: CollectedMessage[], options: DryRunOptions) {
    const logItems = ownerInputs.map(({ deployment, input }) => ({
      deployment,
      input
    }));
    const walletId = ownerInputs[0].deployment.walletId;

    try {
      if (!options.dryRun) {
        await this.managedSignerService.executeDerivedTx(
          walletId,
          ownerInputs.map(i => i.message),
          ownerInputs[0].deployment.isOldWallet ?? false
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
    } catch (error: any) {
      this.logger.error({
        event: "TOP_UP_DEPLOYMENTS_ERROR",
        owner,
        items: logItems,
        message: error.message,
        stack: error.stack,
        dryRun: options.dryRun,
        data: error.data
      });

      this.summarizer.inc("deploymentTopUpErrorCount", ownerInputs.length);
      this.summarizer.trackFailedWallet(owner);

      if (await this.chainErrorService.isMasterWalletInsufficientFundsError(error)) {
        this.logger.error({
          event: "MASTER_WALLET_INSUFFICIENT_FUNDS",
          owner,
          items: logItems,
          message: error.message,
          stack: error.stack,
          dryRun: options.dryRun,
          data: error.data
        });

        throw error;
      } else if (error.message?.startsWith("insufficient funds")) {
        this.summarizer.inc("insufficientBalanceCount");
      }
    }
  }

  private logSummary(options: DryRunOptions) {
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
