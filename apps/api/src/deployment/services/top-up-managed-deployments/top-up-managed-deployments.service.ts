import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { DepositDeploymentMsgOptions, RpcMessageService } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { DryRunOptions } from "@src/core/types/console";
import { DrainingDeployment } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { CachedBalanceService } from "../cached-balance/cached-balance.service";
import { TopUpManagedDeploymentsInstrumentationService } from "./top-up-managed-deployments-instrumentation.service";

type CollectedMessage = {
  message: { typeUrl: string; value: MsgAccountDeposit };
  input: DepositDeploymentMsgOptions;
  deployment: DrainingDeployment;
};

@singleton()
export class TopUpManagedDeploymentsService {
  constructor(
    private readonly managedSignerService: ManagedSignerService,
    private readonly billingConfig: BillingConfigService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly rpcClientService: RpcMessageService,
    private readonly cachedBalanceService: CachedBalanceService,
    private readonly blockHttpService: BlockHttpService,
    private readonly chainErrorService: ChainErrorService,
    private readonly instrumentation: TopUpManagedDeploymentsInstrumentationService
  ) {}

  async topUpDeployments(options: DryRunOptions): Promise<Result<void, unknown[]>> {
    this.instrumentation.start(await this.blockHttpService.getCurrentHeight(), options);
    const errors: unknown[] = [];

    try {
      for await (const { address, deployments } of this.drainingDeploymentService.findDrainingDeploymentsByOwner()) {
        try {
          const messageInputs = await this.collectMessages(deployments);
          if (messageInputs.length) {
            await this.topUpForOwner(address, messageInputs, options);
          } else {
            this.instrumentation.recordSkipped({
              owner: address,
              deploymentCount: deployments.length
            });
          }
        } catch (error: unknown) {
          errors.push(error);
        }
      }
    } catch (error: unknown) {
      errors.push(error);
    } finally {
      const endHeight = await this.blockHttpService.getCurrentHeight().catch(() => undefined);
      this.instrumentation.finish(errors.length ? "failure" : "success", endHeight);
    }

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  private async collectMessages(deployments: DrainingDeployment[]): Promise<CollectedMessage[]> {
    const denom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");

    const messageInputs = await Promise.all(
      deployments.map(async deployment => {
        this.instrumentation.recordDeploymentPreparation(deployment.address, deployment.predictedClosedHeight);

        try {
          const { address } = deployment;

          const [balance, desiredAmount] = await Promise.all([
            this.cachedBalanceService.get(address),
            this.drainingDeploymentService.calculateTopUpAmount(deployment)
          ]);
          if (desiredAmount <= 0) {
            this.instrumentation.recordInvalidDepositAmount({
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
        } catch (error: unknown) {
          this.instrumentation.recordMessagePreparationError({
            deployment,
            error
          });
        }
      })
    );

    return messageInputs.filter(x => !!x);
  }

  private async topUpForOwner(owner: string, ownerInputs: CollectedMessage[], options: DryRunOptions) {
    const walletId = ownerInputs[0].deployment.walletId;

    try {
      if (!options.dryRun) {
        const { address, walletIsTrialing: isTrialing, walletCreatedAt: createdAt } = ownerInputs[0].deployment;
        const feeAllowance = await this.managedSignerService.ensureFeeGrants({ address, isTrialing, createdAt });

        if (feeAllowance <= 0) {
          this.instrumentation.recordChainTxError({
            owner,
            items: ownerInputs,
            error: new Error(`Fee grant missing for wallet ${owner}, unable to top up deployments`)
          });
          return;
        }

        await this.managedSignerService.executeDerivedTx(
          walletId,
          ownerInputs.map(i => i.message)
        );
      }

      this.instrumentation.recordDeposit({ owner, items: ownerInputs });
    } catch (error: unknown) {
      this.instrumentation.recordChainTxError({ owner, items: ownerInputs, error });

      if (error instanceof Error && (await this.chainErrorService.isMasterWalletInsufficientFundsError(error))) {
        this.instrumentation.recordMasterWalletInsufficientFundsError({ owner, items: ownerInputs, error });
        throw error;
      }
    }
  }
}
