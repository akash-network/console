import { LoggerService } from "@akashnetwork/logging";
import { secondsInMinute } from "date-fns/constants";
import { singleton } from "tsyringe";

import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { RpcMessageService } from "@src/billing/services";
import { TxSignerService } from "@src/billing/services/tx-signer/tx-signer.service";
import { ErrorService } from "@src/core/services/error/error.service";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { BlockHttpService } from "@src/deployment/services/block-http/block-http.service";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class StaleManagedDeploymentsCleanerService {
  private readonly logger = new LoggerService({ context: StaleManagedDeploymentsCleanerService.name });

  private readonly MAX_LIVE_BLOCKS = Math.floor((10 * secondsInMinute) / averageBlockTime);

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly blockHttpService: BlockHttpService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly txSignerService: TxSignerService,
    private readonly errorService: ErrorService
  ) {}

  async cleanup() {
    await this.userWalletRepository.paginate({ limit: 10 }, async wallets => {
      const cleanUpAllWallets = wallets.map(async wallet => {
        await this.errorService.execWithErrorHandler({ wallet, event: "DEPLOYMENT_CLEAN_UP_ERROR" }, () => this.cleanUpForWallet(wallet));
      });

      await Promise.all(cleanUpAllWallets);
    });
  }

  private async cleanUpForWallet(wallet: UserWalletOutput) {
    const currentHeight = await this.blockHttpService.getCurrentHeight();
    const client = await this.txSignerService.getClientForAddressIndex(wallet.id);
    const deployments = await this.deploymentRepository.findStaleDeployments({
      owner: wallet.address,
      createdHeight: currentHeight - this.MAX_LIVE_BLOCKS
    });

    const closeAllWalletStaleDeployments = deployments.map(async deployment => {
      const message = this.rpcMessageService.getCloseDeploymentMsg(wallet.address, deployment.dseq);
      this.logger.info({ event: "DEPLOYMENT_CLEAN_UP", params: { owner: wallet.address, dseq: deployment.dseq } });

      await client.signAndBroadcast([message]);

      this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS" });
    });

    await Promise.all(closeAllWalletStaleDeployments);
  }
}
