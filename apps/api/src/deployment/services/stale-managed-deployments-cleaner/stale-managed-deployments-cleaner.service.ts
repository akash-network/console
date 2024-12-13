import { LoggerService } from "@akashnetwork/logging";
import { secondsInMinute } from "date-fns/constants";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockRepository } from "@src/chain/repositories/block.repository";
import { ErrorService } from "@src/core/services/error/error.service";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { CleanUpStaleDeploymentsParams } from "@src/deployment/types/state-deployments";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class StaleManagedDeploymentsCleanerService {
  private readonly logger = LoggerService.forContext(StaleManagedDeploymentsCleanerService.name);

  private readonly MAX_LIVE_BLOCKS = Math.floor((10 * secondsInMinute) / averageBlockTime);

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly blockRepository: BlockRepository,
    private readonly rpcMessageService: RpcMessageService,
    private readonly managedSignerService: ManagedSignerService,
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly errorService: ErrorService
  ) {}

  async cleanup(options: CleanUpStaleDeploymentsParams) {
    await this.userWalletRepository.paginate({ limit: options.concurrency || 10 }, async wallets => {
      const cleanUpAllWallets = wallets.map(async wallet => {
        await this.errorService.execWithErrorHandler(
          {
            wallet,
            event: "DEPLOYMENT_CLEAN_UP_ERROR",
            context: StaleManagedDeploymentsCleanerService.name
          },
          () => this.cleanUpForWallet(wallet)
        );
      });

      await Promise.all(cleanUpAllWallets);
    });
  }

  private async cleanUpForWallet(wallet: UserWalletOutput) {
    const currentHeight = await this.blockRepository.getLatestProcessedHeight();
    const deployments = await this.deploymentRepository.findStaleDeployments({
      owner: wallet.address,
      createdHeight: currentHeight - this.MAX_LIVE_BLOCKS
    });

    const messages = deployments.map(deployment => this.rpcMessageService.getCloseDeploymentMsg(wallet.address, deployment.dseq));

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP", owner: wallet.address });

    try {
      await this.managedSignerService.executeManagedTx(wallet.id, messages);
      this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address });
    } catch (error) {
      if (error.message.includes("not allowed to pay fees")) {
        await this.managedUserWalletService.authorizeSpending({
          address: wallet.address,
          limits: {
            fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
          }
        });

        await this.managedSignerService.executeManagedTx(wallet.id, messages);
        this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address });
      } else {
        throw error;
      }
    }
  }
}
