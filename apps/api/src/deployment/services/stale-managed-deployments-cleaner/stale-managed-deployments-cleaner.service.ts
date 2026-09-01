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
import { averageBlockTime, COSMOS_TX_CODE_OK } from "@src/utils/constants";

/** Bounds how many already-closed deployments one pass drops; the batch left after the last drop is still broadcast once. */
const MAX_CLOSED_DEPLOYMENT_DROPS = 3;

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

  /** Dropping a message and re-broadcasting is safe because both classified failures reject the tx whole: an estimate never lands, a non-zero code reverts. */
  async #closeLeaselessDeployments(wallet: UserWalletOutput, staleBeforeHeight: number) {
    let remaining = await this.deploymentRepository.findStaleDeployments({
      owner: wallet.address!,
      createdHeight: staleBeforeHeight
    });

    if (!remaining.length) {
      return;
    }

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP", owner: wallet.address });

    let closedDeploymentsDropped = 0;

    while (remaining.length) {
      const messages = remaining.map(deployment => this.rpcMessageService.getCloseDeploymentMsg(wallet.address!, deployment.dseq));
      const failure = await this.closeDeployments(wallet, messages);

      if (!failure) {
        break;
      }

      const closedIndex = this.chainErrorService.getClosedDeploymentMessageIndex(failure, remaining.length);

      if (closedIndex === undefined) {
        if (failure instanceof Error && this.chainErrorService.isUnsettleableDeploymentError(failure)) {
          this.logger.error({
            event: "DEPLOYMENT_CLEAN_UP_UNSETTLEABLE",
            reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
            owner: wallet.address
          });
          return;
        }

        throw failure;
      }

      if (closedDeploymentsDropped >= MAX_CLOSED_DEPLOYMENT_DROPS) {
        this.logger.warn({ event: "DEPLOYMENT_CLEAN_UP_DROP_LIMIT", owner: wallet.address, remainingCount: remaining.length });
        return;
      }

      this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: wallet.address, dseq: remaining[closedIndex].dseq });
      remaining = remaining.filter((_, index) => index !== closedIndex);
      closedDeploymentsDropped++;
    }

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address, alreadyClosedCount: closedDeploymentsDropped });
  }

  /** Returns the failure rather than throwing so the caller classifies a rejected estimate and a reverted tx alike. */
  private async closeDeployments(wallet: UserWalletOutput, messages: EncodeObject[]): Promise<unknown> {
    try {
      await this.#broadcastClose(wallet.id, messages);
      return undefined;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("not allowed to pay fees")) {
        return error;
      }

      await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
        address: wallet.address!,
        limits: {
          fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
        }
      });

      try {
        await this.#broadcastClose(wallet.id, messages);
        return undefined;
      } catch (retryError) {
        return retryError;
      }
    }
  }

  async #broadcastClose(walletId: number, messages: EncodeObject[]): Promise<void> {
    const tx = await this.managedSignerService.executeDerivedTx(walletId, messages);

    if (tx.code !== COSMOS_TX_CODE_OK) {
      throw new Error(`Close tx ${tx.hash} failed on-chain with code ${tx.code}: ${tx.rawLog}`);
    }
  }
}
