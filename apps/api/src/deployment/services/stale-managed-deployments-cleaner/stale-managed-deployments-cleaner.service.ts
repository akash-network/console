import type { EncodeObject } from "@cosmjs/proto-signing";
import { secondsInMinute } from "date-fns/constants";
import { inject, singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockRepository } from "@src/chain/repositories/block.repository";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { ErrorService } from "@src/core/services/error/error.service";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { CleanUpStaleDeploymentsParams } from "@src/deployment/types/state-deployments";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class StaleManagedDeploymentsCleanerService {
  private readonly MAX_LIVE_BLOCKS = Math.floor((10 * secondsInMinute) / averageBlockTime);

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly blockRepository: BlockRepository,
    private readonly rpcMessageService: RpcMessageService,
    private readonly managedSignerService: ManagedSignerService,
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly errorService: ErrorService,
    private readonly chainErrorService: ChainErrorService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: StaleManagedDeploymentsCleanerService.name });
  }

  async cleanup(options: CleanUpStaleDeploymentsParams) {
    const staleBeforeHeight = await this.#resolveStaleBeforeHeight(this.MAX_LIVE_BLOCKS);

    await this.userWalletRepository.paginate({ limit: options.concurrency || 10 }, async wallets => {
      const cleanUpAllWallets = wallets.map(async wallet => {
        await this.errorService.execWithErrorHandler(
          {
            wallet,
            event: "DEPLOYMENT_CLEAN_UP_ERROR",
            context: StaleManagedDeploymentsCleanerService.name
          },
          () => this.#closeLeaselessDeployments(wallet, staleBeforeHeight)
        );
      });

      await Promise.all(cleanUpAllWallets);
    });
  }

  async cleanUpForWallet(wallet: UserWalletOutput, maxLiveBlocks: number = this.MAX_LIVE_BLOCKS) {
    await this.#closeLeaselessDeployments(wallet, await this.#resolveStaleBeforeHeight(maxLiveBlocks));
  }

  /** Read once per sweep instead of per wallet: the tip is the same for every one of them, and the sweep walks the whole managed-wallet table. */
  async #resolveStaleBeforeHeight(maxLiveBlocks: number): Promise<number> {
    return (await this.blockRepository.getLatestProcessedHeight()) - maxLiveBlocks;
  }

  async #closeLeaselessDeployments(wallet: UserWalletOutput, staleBeforeHeight: number) {
    const deployments = await this.deploymentRepository.findStaleDeployments({
      owner: wallet.address!,
      createdHeight: staleBeforeHeight
    });

    const messages = deployments.map(deployment => this.rpcMessageService.getCloseDeploymentMsg(wallet.address!, deployment.dseq));

    if (!messages.length) {
      return;
    }

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP", owner: wallet.address });

    try {
      await this.closeDeployments(wallet, messages);
      this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address });
    } catch (error) {
      if (error instanceof Error && this.chainErrorService.isUnsettleableDeploymentError(error)) {
        this.logger.error({
          event: "DEPLOYMENT_CLEAN_UP_UNSETTLEABLE",
          reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
          owner: wallet.address
        });
        return;
      }

      throw error;
    }
  }

  private async closeDeployments(wallet: UserWalletOutput, messages: EncodeObject[]) {
    try {
      await this.managedSignerService.executeDerivedTx(wallet.id, messages);
    } catch (error: any) {
      if (!error.message.includes("not allowed to pay fees")) {
        throw error;
      }

      await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
        address: wallet.address!,
        limits: {
          fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
        }
      });

      await this.managedSignerService.executeDerivedTx(wallet.id, messages);
    }
  }
}
