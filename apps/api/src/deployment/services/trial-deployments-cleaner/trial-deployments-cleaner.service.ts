import { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockRepository } from "@src/chain/repositories/block.repository";
import { ErrorService } from "@src/core/services/error/error.service";
import { DeploymentRepository, StaleDeploymentsOutput } from "@src/deployment/repositories/deployment/deployment.repository";
import { CleanUpTrialDeploymentsParams } from "@src/deployment/types/trial-deployments";
import { averageBlockCountInAnHour } from "@src/utils/constants";

@singleton()
export class TrialDeploymentsCleanerService {
  private readonly MAX_LIVE_BLOCKS = Math.floor(this.config.TRIAL_DEPLOYMENT_CLEANUP_HOURS * averageBlockCountInAnHour);

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly blockRepository: BlockRepository,
    private readonly rpcMessageService: RpcMessageService,
    private readonly managedSignerService: ManagedSignerService,
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly errorService: ErrorService,
    @inject("TrialDeploymentsCleanerServiceLogger", { isOptional: true })
    private readonly logger = LoggerService.forContext(TrialDeploymentsCleanerService.name)
  ) {}

  async cleanup(options: CleanUpTrialDeploymentsParams) {
    const currentHeight = await this.blockRepository.getLatestHeight();
    const cutoffHeight = currentHeight - this.MAX_LIVE_BLOCKS;

    this.logger.info({
      event: "TRIAL_DEPLOYMENT_CLEANUP_START",
      currentHeight,
      cutoffHeight,
      cleanupHours: this.config.TRIAL_DEPLOYMENT_CLEANUP_HOURS
    });

    await this.userWalletRepository.paginate(
      {
        query: { isTrialing: true },
        limit: options.concurrency || 10
      },
      async wallets => {
        const cleanUpAllWallets = wallets.map(async wallet => {
          await this.errorService.execWithErrorHandler(
            {
              wallet,
              event: "TRIAL_DEPLOYMENT_CLEANUP_ERROR",
              context: TrialDeploymentsCleanerService.name
            },
            () => this.cleanUpForWallet(wallet, cutoffHeight)
          );
        });

        await Promise.all(cleanUpAllWallets);
      }
    );

    this.logger.info({ event: "TRIAL_DEPLOYMENT_CLEANUP_COMPLETE" });
  }

  private async cleanUpForWallet(wallet: UserWalletOutput, cutoffHeight: number) {
    const deployments = await this.deploymentRepository.findDeploymentsBeforeCutoff({
      owner: wallet.address!,
      cutoffHeight
    });

    if (!deployments.length) {
      return;
    }

    const messages = deployments.map((deployment: StaleDeploymentsOutput) => this.rpcMessageService.getCloseDeploymentMsg(wallet.address!, deployment.dseq));

    this.logger.info({
      event: "TRIAL_DEPLOYMENT_CLEANUP",
      owner: wallet.address,
      deploymentCount: deployments.length,
      dseqs: deployments.map((d: StaleDeploymentsOutput) => d.dseq)
    });

    try {
      await this.managedSignerService.executeManagedTx(wallet.id, messages);
      this.logger.info({
        event: "TRIAL_DEPLOYMENT_CLEANUP_SUCCESS",
        owner: wallet.address,
        deploymentCount: deployments.length
      });
    } catch (error: any) {
      if (error.message.includes("not allowed to pay fees")) {
        await this.managedUserWalletService.authorizeSpending({
          address: wallet.address!,
          limits: {
            fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
          }
        });

        await this.managedSignerService.executeManagedTx(wallet.id, messages);
        this.logger.info({
          event: "TRIAL_DEPLOYMENT_CLEANUP_SUCCESS",
          owner: wallet.address,
          deploymentCount: deployments.length
        });
      } else {
        throw error;
      }
    }
  }
}
