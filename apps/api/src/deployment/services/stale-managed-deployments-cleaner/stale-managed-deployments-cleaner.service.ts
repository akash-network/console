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

/** Bounds how many already-closed deployments one owner's pass drops; the batch left after the last drop is still broadcast once. */
const MAX_CLOSED_DEPLOYMENT_DROPS = 3;

/** How many owners one chain query screens, which bounds both the query payload and the rows held in memory at once. */
const WALLET_BATCH_SIZE = 5_000;

/** Keeps one owner's orphans from growing into a transaction the chain refuses for gas, which no amount of retrying fixes. */
const MAX_CLOSES_PER_TX = 20;

/** How far the indexer may trail the chain before the sweep refuses to run, because a lagging indexer reads a leased deployment as lease-less. */
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

  /** One owner's failed close is logged and counted rather than failing the run, because a persistently failing owner would otherwise keep every run red. */
  async cleanup(options: CleanUpStaleDeploymentsParams): Promise<Result<void, unknown[]>> {
    const startedAt = Date.now();
    const indexedHeight = await this.#resolveFreshIndexedHeight();

    if (indexedHeight === undefined) {
      return Err([new Error("Indexer is too far behind the chain to tell an orphan from a leased deployment")]);
    }

    const staleBeforeHeight = indexedHeight - this.MAX_LIVE_BLOCKS;
    const screenErrors: unknown[] = [];
    let screened = 0;
    let owners = 0;
    let failedOwners = 0;

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SWEEP_START", staleBeforeHeight, dryRun: options.dryRun });

    for await (const wallets of this.userWalletRepository.findManagedIteratively({ batchSize: WALLET_BATCH_SIZE })) {
      const batch = await this.#cleanUpBatch(wallets, staleBeforeHeight, options);

      screened += wallets.length;
      owners += batch.owners;
      failedOwners += batch.failedOwners;
      screenErrors.push(...batch.screenErrors);
    }

    this.logger.info({
      event: "DEPLOYMENT_CLEAN_UP_SWEEP_END",
      screened,
      owners,
      failedOwners,
      screenFailures: screenErrors.length,
      durationMs: Date.now() - startedAt,
      dryRun: options.dryRun
    });

    return screenErrors.length > 0 ? Err(screenErrors) : Ok(undefined);
  }

  async cleanUpForWallet(wallet: UserWalletOutput, maxLiveBlocks: number = this.MAX_LIVE_BLOCKS) {
    const staleBeforeHeight = (await this.blockRepository.getLatestProcessedHeight()) - maxLiveBlocks;
    const managedWallet = { id: wallet.id, address: wallet.address! };
    const deployments = await this.deploymentRepository.findStaleDeployments({ owners: [managedWallet.address], staleBeforeHeight });

    await this.#closeDeploymentsWithoutActiveLease(managedWallet, deployments);
  }

  /** One query screens the whole batch, so a batch holding no orphan at all costs exactly that one query. */
  async #cleanUpBatch(
    wallets: ManagedWalletRef[],
    staleBeforeHeight: number,
    options: CleanUpStaleDeploymentsParams
  ): Promise<{ owners: number; failedOwners: number; screenErrors: unknown[] }> {
    const screenErrors: unknown[] = [];
    const deployments = await this.errorService.execWithErrorHandler(
      {
        event: "DEPLOYMENT_CLEAN_UP_SCREEN_ERROR",
        context: StaleManagedDeploymentsCleanerService.name
      },
      () => this.deploymentRepository.findStaleDeployments({ owners: wallets.map(wallet => wallet.address), staleBeforeHeight }),
      error => screenErrors.push(error)
    );
    const orphansByOwner = groupByOwner(deployments ?? []);

    if (options.dryRun) {
      for (const [owner, orphans] of orphansByOwner) {
        this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_WOULD_CLOSE", owner, dseqs: orphans.map(orphan => orphan.dseq) });
      }

      return { owners: orphansByOwner.size, failedOwners: 0, screenErrors };
    }

    const walletsByAddress = new Map(wallets.map(wallet => [wallet.address, wallet]));
    let failedOwners = 0;

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
            () => failedOwners++
          );
        })
      );
    }

    return { owners: orphansByOwner.size, failedOwners, screenErrors };
  }

  /** Undefined when the indexer cannot see enough of the chain for this sweep's cutoff to mean anything. */
  async #resolveFreshIndexedHeight(): Promise<number | undefined> {
    const [chainHeight, indexedHeight] = await Promise.all([this.blockHttpService.getCurrentHeight(), this.blockRepository.getLatestProcessedHeight()]);
    const lag = chainHeight - indexedHeight;

    if (lag <= MAX_INDEXER_LAG_IN_BLOCKS) return indexedHeight;

    this.logger.error({ event: "DEPLOYMENT_CLEAN_UP_INDEXER_LAGGING", chainHeight, indexedHeight, lag, maxLag: MAX_INDEXER_LAG_IN_BLOCKS });

    return undefined;
  }

  /** Dropping a message and re-broadcasting is safe because both classified failures reject the tx whole: an estimate never lands, a non-zero code reverts. */
  async #closeDeploymentsWithoutActiveLease(wallet: ManagedWalletRef, deployments: StaleDeploymentsOutput[]) {
    if (!deployments.length) {
      return;
    }

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP", owner: wallet.address });

    let alreadyClosedCount = 0;

    for (const batch of chunk(deployments, MAX_CLOSES_PER_TX)) {
      const dropped = await this.#closeBatch(wallet, batch, MAX_CLOSED_DEPLOYMENT_DROPS - alreadyClosedCount);

      if (dropped === undefined) return;

      alreadyClosedCount += dropped;
    }

    this.logger.info({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address, alreadyClosedCount });
  }

  /** Returns how many already-closed deployments it dropped, or undefined when the wallet is left for the next run. */
  async #closeBatch(wallet: ManagedWalletRef, deployments: StaleDeploymentsOutput[], dropBudget: number): Promise<number | undefined> {
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

      if (closedDeploymentsDropped >= dropBudget) {
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
      if (!this.chainErrorService.isFeeGrantRefusedError(error)) {
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
