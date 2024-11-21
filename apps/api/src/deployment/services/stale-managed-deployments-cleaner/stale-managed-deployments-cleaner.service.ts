import { LoggerService } from "@akashnetwork/logging";
import { secondsInMinute } from "date-fns/constants";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import { TxSignerService } from "@src/billing/services/tx-signer/tx-signer.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { ErrorService } from "@src/core/services/error/error.service";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { averageBlockTime } from "@src/utils/constants";

export interface CleanUpStaleDeploymentsParams {
  concurrency: number;
}

@singleton()
export class StaleManagedDeploymentsCleanerService {
  private readonly logger = LoggerService.forContext(StaleManagedDeploymentsCleanerService.name);

  private readonly MAX_LIVE_BLOCKS = Math.floor((10 * secondsInMinute) / averageBlockTime);

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly blockHttpService: BlockHttpService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly txSignerService: TxSignerService,
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
    const currentHeight = await this.blockHttpService.getLatestProcessedHeight();
    const client = await this.txSignerService.getClientForAddressIndex(wallet.id);
    const deployments = await this.deploymentRepository.findStaleDeployments({
      owner: wallet.address,
      createdHeight: currentHeight - this.MAX_LIVE_BLOCKS
    });

    const closeAllWalletStaleDeployments = deployments.map(async deployment => {
      const message = this.rpcMessageService.getCloseDeploymentMsg(wallet.address, deployment.dseq);
      this.logger.info({ event: "DEPLOYMENT_CLEAN_UP", params: { owner: wallet.address, dseq: deployment.dseq } });

      try {
        await client.signAndBroadcast([message]);
        this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS" });
      } catch (error) {
        if (error.message.includes("not allowed to pay fees")) {
          await this.managedUserWalletService.authorizeSpending({
            address: wallet.address,
            limits: {
              fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
            }
          });

          await client.signAndBroadcast([message]);
          this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS" });
        } else {
          throw error;
        }
      }
    });

    await Promise.all(closeAllWalletStaleDeployments);
  }
}
