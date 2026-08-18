import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { DepositDeploymentMsgOptions, RpcMessageService } from "@src/billing/services";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DrainingDeployment } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";
import { CachedBalance, CachedBalanceService } from "../cached-balance/cached-balance.service";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import type { DeploymentTopUpInstrumentation } from "./deployment-top-up-instrumentation";
import { FundDrainingDeploymentsInstrumentationService } from "./fund-draining-deployments-instrumentation.service";
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
    private readonly instrumentation: TopUpManagedDeploymentsInstrumentationService,
    private readonly fundDrainingInstrumentation: FundDrainingDeploymentsInstrumentationService,
    private readonly walletReloadService: WalletReloadJobService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly deploymentConfig: DeploymentConfigService
  ) {}

  async topUpDeployments(options: DryRunOptions): Promise<Result<void, unknown[]>> {
    this.instrumentation.start(await this.blockHttpService.getCurrentHeight(), options);
    const errors: unknown[] = [];

    try {
      for await (const owner of this.drainingDeploymentService.findDrainingDeploymentsByOwner()) {
        try {
          const balance = await this.cachedBalanceService.get(owner.address);
          await this.#fundOwnerDeployments(owner, options, balance, this.instrumentation);
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

  /**
   * Funds a single owner's draining deployments immediately, reusing the cron's
   * per-owner path. Triggered off-cron the moment credits land so a deployment
   * about to drain does not wait up to an hour for the next scheduled pass.
   */
  async topUpDrainingDeploymentsForOwner({ walletId, address }: { walletId: number; address: string }): Promise<void> {
    const deployments = await this.drainingDeploymentService.findDrainingDeploymentsForOwner(address, this.fundDrainingInstrumentation);

    if (!deployments.length) {
      this.fundDrainingInstrumentation.recordSkipped({ owner: address, deploymentCount: 0 });
      return;
    }

    const balance = await this.cachedBalanceService.getFresh(address);
    await this.#fundOwnerDeployments({ address, walletId, deployments }, { dryRun: false }, balance, this.fundDrainingInstrumentation);
  }

  async #fundOwnerDeployments(
    { address, walletId, deployments }: { address: string; walletId: number; deployments: DrainingDeployment[] },
    options: DryRunOptions,
    balance: CachedBalance,
    instrumentation: DeploymentTopUpInstrumentation
  ): Promise<void> {
    const messageInputs = await this.collectMessages(deployments, balance, instrumentation);

    if (!messageInputs.length) {
      instrumentation.recordSkipped({ owner: address, deploymentCount: deployments.length });
      return;
    }

    if (options.dryRun) {
      await this.topUpForOwner(address, messageInputs, options, instrumentation);
      return;
    }

    const claimedInputs = await this.#claimForFunding(messageInputs);

    if (!claimedInputs.length) {
      instrumentation.recordSkipped({ owner: address, deploymentCount: deployments.length });
      return;
    }

    const claimedIds = claimedInputs.map(input => input.deployment.id);
    let deposited = false;

    try {
      deposited = await this.topUpForOwner(address, claimedInputs, options, instrumentation);
    } finally {
      if (!deposited) {
        await this.deploymentSettingRepository.releaseFundingClaim(claimedIds);
      }
    }

    await this.walletReloadService.scheduleImmediate({ walletId });
  }

  async #claimForFunding(messageInputs: CollectedMessage[]): Promise<CollectedMessage[]> {
    const cooldownMinutes = this.deploymentConfig.get("AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN");
    const claimedIds = new Set(
      await this.deploymentSettingRepository.claimForFunding(
        messageInputs.map(input => input.deployment.id),
        cooldownMinutes
      )
    );

    return messageInputs.filter(input => claimedIds.has(input.deployment.id));
  }

  private async collectMessages(
    deployments: DrainingDeployment[],
    balance: CachedBalance,
    instrumentation: DeploymentTopUpInstrumentation
  ): Promise<CollectedMessage[]> {
    const denom = this.billingConfig.get("DEPLOYMENT_GRANT_DENOM");

    const messageInputs = await Promise.all(
      deployments.map(async deployment => {
        instrumentation.recordDeploymentPreparation(deployment.address, deployment.predictedClosedHeight);

        try {
          const desiredAmount = await this.drainingDeploymentService.calculateTopUpAmount(deployment);
          if (desiredAmount <= 0) {
            instrumentation.recordInvalidDepositAmount({
              desiredAmount,
              dseq: deployment.dseq,
              address: deployment.address,
              blockRate: deployment.blockRate
            });
            return;
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
          instrumentation.recordMessagePreparationError({
            deployment,
            error
          });
        }
      })
    );

    return messageInputs.filter(x => !!x);
  }

  private async topUpForOwner(
    owner: string,
    ownerInputs: CollectedMessage[],
    options: DryRunOptions,
    instrumentation: DeploymentTopUpInstrumentation
  ): Promise<boolean> {
    const walletId = ownerInputs[0].deployment.walletId;

    try {
      if (!options.dryRun) {
        const { address, walletIsTrialing: isTrialing, walletCreatedAt: createdAt, walletActivatedAt: activatedAt } = ownerInputs[0].deployment;
        const feeAllowance = await this.managedSignerService.ensureFeeGrants({ address, isTrialing, createdAt, activatedAt });

        if (feeAllowance <= 0) {
          instrumentation.recordChainTxError({
            owner,
            items: ownerInputs,
            error: new Error(`Fee grant missing for wallet ${owner}, unable to top up deployments`)
          });
          return false;
        }

        const tx = await this.managedSignerService.executeDerivedTx(
          walletId,
          ownerInputs.map(i => i.message)
        );

        if (tx.code !== COSMOS_TX_CODE_OK) {
          instrumentation.recordChainTxError({
            owner,
            items: ownerInputs,
            error: new Error(`Deposit tx ${tx.hash} failed on-chain with code ${tx.code}: ${tx.rawLog}`)
          });
          return false;
        }
      }

      instrumentation.recordDeposit({ owner, items: ownerInputs });
      return true;
    } catch (error: unknown) {
      instrumentation.recordChainTxError({ owner, items: ownerInputs, error });

      if (error instanceof Error && (await this.chainErrorService.isMasterWalletInsufficientFundsError(error))) {
        instrumentation.recordMasterWalletInsufficientFundsError({ owner, items: ownerInputs, error });
        throw error;
      }

      return false;
    }
  }
}
