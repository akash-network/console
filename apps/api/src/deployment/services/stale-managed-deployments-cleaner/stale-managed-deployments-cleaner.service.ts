import type { EncodeObject } from "@cosmjs/proto-signing";
import { secondsInMinute } from "date-fns/constants";
import { chunk } from "lodash";
import { Err, Ok, Result } from "ts-results";
import { inject, singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type ManagedWalletRef, UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockRepository } from "@src/chain/repositories/block.repository";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { ErrorService } from "@src/core/services/error/error.service";
import { DeploymentRepository, type StaleDeployment, type StaleDeploymentsOutput } from "@src/deployment/repositories/deployment/deployment.repository";
import { CleanUpStaleDeploymentsParams } from "@src/deployment/types/state-deployments";
import { averageBlockTime, COSMOS_TX_CODE_OK } from "@src/utils/constants";

/** Bounds how many already-closed deployments one pass drops; the batch left after the last drop is still broadcast once. */
const MAX_CLOSED_DEPLOYMENT_DROPS = 3;

/** How many owners one chain query screens, which bounds both the query payload and the rows held in memory at once. */
const WALLET_BATCH_SIZE = 5_000;

/** Keeps one owner's orphans from growing into a transaction the chain refuses for gas, which no amount of retrying fixes. */
const MAX_CLOSES_PER_TX = 20;

/**
 * How far the indexer may trail the chain before a sweep refuses to run: the staleness cutoff is derived from the last
 * indexed height, so an indexer far enough behind reports a leased deployment as lease-less and the sweep closes a live one.
 */
const MAX_INDEXER_LAG_IN_BLOCKS = Math.floor((10 * secondsInMinute) / averageBlockTime);

function groupByOwner(deployments: StaleDeployment[]): Map<string, StaleDeployment[]> {
  const byOwner = new Map<string, StaleDeployment[]>();

  for (const deployment of deployments) {
    byOwner.set(deployment.owner, [...(byOwner.get(deployment.owner) ?? []), deployment]);
  }

  return byOwner;
}

@singleton()
export class StaleManagedDeploymentsCleanerService {
  private readonly MAX_LIVE_BLOCKS = Math.floor((10 * secondsInMinute) / averageBlockTime);

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly blockRepository: BlockRepository,
    private readonly blockHttpService: BlockHttpService,
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

  /**
   * Asks the chain which of a batch of managed wallets owns an orphan rather than asking each wallet in turn, so the run
   * costs a query per batch instead of a query per wallet and stays flat as the wallet table grows.
   */
  async cleanup(options: CleanUpStaleDeploymentsParams): Promise<Result<void, unknown[]>> {
    const indexedHeight = await this.#resolveFreshIndexedHeight();

    if (indexedHeight === undefined) {
      return Err([new Error("Indexer is too far behind the chain to tell an orphan from a leased deployment")]);
    }

    const staleBeforeHeight = indexedHeight - this.MAX_LIVE_BLOCKS;
    const errors: unknown[] = [];
    let screened = 0;
    let owners = 0;

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SWEEP_START", staleBeforeHeight, dryRun: options.dryRun });

    for await (const wallets of this.userWalletRepository.findManagedIteratively({ batchSize: WALLET_BATCH_SIZE })) {
      const batch = await this.#cleanUpBatch(wallets, staleBeforeHeight, options);

      screened += wallets.length;
      owners += batch.owners;
      errors.push(...batch.errors);
    }

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SWEEP_END", screened, owners, failed: errors.length, dryRun: options.dryRun });

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  async cleanUpForWallet(wallet: UserWalletOutput, maxLiveBlocks: number = this.MAX_LIVE_BLOCKS) {
    const staleBeforeHeight = await this.#resolveStaleBeforeHeight(maxLiveBlocks);
    const managedWallet = { id: wallet.id, address: wallet.address! };
    const deployments = await this.deploymentRepository.findStaleDeployments({ owners: [managedWallet.address], staleBeforeHeight });

    await this.#closeDeploymentsWithoutActiveLease(managedWallet, deployments);
  }

  /** One query screens the whole batch, so a batch holding no orphan at all costs exactly that one query. */
  async #cleanUpBatch(
    wallets: ManagedWalletRef[],
    staleBeforeHeight: number,
    options: CleanUpStaleDeploymentsParams
  ): Promise<{ owners: number; errors: unknown[] }> {
    const deployments = await this.deploymentRepository.findStaleDeployments({
      owners: wallets.map(wallet => wallet.address),
      staleBeforeHeight
    });
    const orphansByOwner = groupByOwner(deployments);
    const errors: unknown[] = [];

    if (options.dryRun) {
      for (const [owner, orphans] of orphansByOwner) {
        this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_WOULD_CLOSE", owner, dseqs: orphans.map(orphan => orphan.dseq) });
      }

      return { owners: orphansByOwner.size, errors };
    }

    const walletsByAddress = new Map(wallets.map(wallet => [wallet.address, wallet]));

    for (const group of chunk([...orphansByOwner], options.concurrency || 10)) {
      await Promise.all(
        group.map(async ([owner, orphans]) => {
          await this.errorService.execWithErrorHandler(
            {
              owner,
              event: "DEPLOYMENT_CLEAN_UP_ERROR",
              context: StaleManagedDeploymentsCleanerService.name
            },
            () => this.#closeDeploymentsWithoutActiveLease(walletsByAddress.get(owner)!, orphans),
            error => errors.push(error)
          );
        })
      );
    }

    return { owners: orphansByOwner.size, errors };
  }

  /** The chain is the authority on where the tip is; the indexer only says how much of it this sweep can see. Undefined means it cannot see enough. */
  async #resolveFreshIndexedHeight(): Promise<number | undefined> {
    const [chainHeight, indexedHeight] = await Promise.all([this.blockHttpService.getCurrentHeight(), this.blockRepository.getLatestProcessedHeight()]);
    const lag = chainHeight - indexedHeight;

    if (lag <= MAX_INDEXER_LAG_IN_BLOCKS) return indexedHeight;

    this.logger.error({ event: "DEPLOYMENT_CLEAN_UP_INDEXER_LAGGING", chainHeight, indexedHeight, lag, maxLag: MAX_INDEXER_LAG_IN_BLOCKS });

    return undefined;
  }

  /** Read once per sweep instead of per wallet: the tip is the same for every one of them, and the sweep walks the whole managed-wallet table. */
  async #resolveStaleBeforeHeight(maxLiveBlocks: number): Promise<number> {
    return (await this.blockRepository.getLatestProcessedHeight()) - maxLiveBlocks;
  }

  /** Dropping a message and re-broadcasting is safe because both classified failures reject the tx whole: an estimate never lands, a non-zero code reverts. */
  async #closeDeploymentsWithoutActiveLease(wallet: ManagedWalletRef, deployments: StaleDeploymentsOutput[]) {
    if (!deployments.length) {
      return;
    }

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP", owner: wallet.address });

    let alreadyClosedCount = 0;

    for (const batch of chunk(deployments, MAX_CLOSES_PER_TX)) {
      const dropped = await this.#closeBatch(wallet, batch);

      if (dropped === undefined) return;

      alreadyClosedCount += dropped;
    }

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address, alreadyClosedCount });
  }

  /** Returns how many already-closed deployments it dropped, or undefined when the wallet is left for the next run. */
  async #closeBatch(wallet: ManagedWalletRef, deployments: StaleDeploymentsOutput[]): Promise<number | undefined> {
    let remaining = deployments;
    let closedDeploymentsDropped = 0;

    while (remaining.length) {
      const messages = remaining.map(deployment => this.rpcMessageService.getCloseDeploymentMsg(wallet.address, deployment.dseq));
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
          return undefined;
        }

        throw failure;
      }

      if (closedDeploymentsDropped >= MAX_CLOSED_DEPLOYMENT_DROPS) {
        this.logger.warn({ event: "DEPLOYMENT_CLEAN_UP_DROP_LIMIT", owner: wallet.address, remainingCount: remaining.length });
        return undefined;
      }

      this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: wallet.address, dseq: remaining[closedIndex].dseq });
      remaining = remaining.filter((_, index) => index !== closedIndex);
      closedDeploymentsDropped++;
    }

    return closedDeploymentsDropped;
  }

  /** Returns the failure rather than throwing so the caller classifies a rejected estimate and a reverted tx alike. */
  private async closeDeployments(wallet: ManagedWalletRef, messages: EncodeObject[]): Promise<unknown> {
    try {
      await this.#broadcastClose(wallet.id, messages);
      return undefined;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("not allowed to pay fees")) {
        return error;
      }

      await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
        address: wallet.address,
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
