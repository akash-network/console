import { addMilliseconds, addMinutes, subMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type DeploymentDepositOutput, DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import { DeploymentSpendRepository, type LandingWindow } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type LandedTx, TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import {
  type CreateLogger,
  type Job,
  JOB_NAME,
  type JobHandler,
  type JobMeta,
  type JobPayload,
  type JobPermissions,
  JobQueueService,
  LOGGER_FACTORY
} from "@src/core";
import { TxService } from "@src/core/services";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";

/** Clock-skew and create-to-sign slack on a bound that holds only while TX_SIGNER_REQUEST_TIMEOUT_MS stays above tx-signer's SIGN_AND_BROADCAST_DEADLINE_MS, which every attempt it signs expires within. */
const LANDING_MARGIN_IN_MIN = 1;

/** How often a check waits for a chain index that has not reached the deposits' window yet before it voids them. */
const MAX_INDEX_LAG_RETRIES = 6;

const INDEX_LAG_RETRY_DELAY_IN_MIN = 10;

type IndexCheck = { depositIds: string[]; indexLagRetries?: number };

type HashCheck = { txHash: string; indexLagRetries?: number };

/** Settles the ledger rows of a deposit the signer left undecided: by its hash when the signer gave one, else by the chain index. */
export class ReconcileDeploymentDeposit implements Job {
  static readonly [JOB_NAME] = "ReconcileDeploymentDeposit";
  readonly name = ReconcileDeploymentDeposit[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: HashCheck | IndexCheck) {}
}

@singleton()
export class ReconcileDeploymentDepositHandler implements JobHandler<ReconcileDeploymentDeposit> {
  public readonly accepts = ReconcileDeploymentDeposit;

  /** One queued check per hash or row set, so the deposits of one transaction are settled by a single job. */
  public readonly policy = "short";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly txPresenceService: TxPresenceService,
    private readonly deploymentDepositRepository: DeploymentDepositRepository,
    private readonly deploymentSpendRepository: DeploymentSpendRepository,
    private readonly billingConfigService: BillingConfigService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ReconcileDeploymentDepositHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Absence is asked again while retries remain, since a pooled endpoint can lag; after that, and in a check re-queued for the index, the chain index decides once it has passed the deposits' window. */
  async handle(payload: JobPayload<ReconcileDeploymentDeposit>, job?: JobMeta): Promise<void> {
    const isAbsenceFinal = !job || job.retryCount >= job.retryLimit || !!payload.indexLagRetries;

    if ("txHash" in payload) {
      await this.#reconcileByHash(payload, isAbsenceFinal);
      return;
    }

    await this.#reconcileByIndex(payload, isAbsenceFinal);
  }

  async #reconcileByHash({ txHash, indexLagRetries = 0 }: HashCheck, isAbsenceFinal: boolean): Promise<void> {
    const tx = await this.#findTxOnChain(txHash, isAbsenceFinal);

    if (tx) {
      await this.#settleByHash(txHash, { isSucceeded: tx.code === COSMOS_TX_CODE_OK });
      return;
    }

    if (!isAbsenceFinal) {
      throw new Error(`Deposit transaction ${txHash} is not visible on chain yet`);
    }

    const latestBlockTime = await this.deploymentSpendRepository.findLatestBlockTime();
    const result = await this.deploymentSpendRepository.findTxResult(txHash);

    if (!result && (await this.#waitForIndexToPassHash(txHash, latestBlockTime, indexLagRetries))) return;

    await this.#settleByHash(txHash, result);
  }

  /** Once absence is final the chain index decides, so a failing endpoint then counts as not seeing the tx rather than leaving the rows pending for good. */
  async #findTxOnChain(txHash: string, isAbsenceFinal: boolean): Promise<LandedTx | null> {
    try {
      return await this.txPresenceService.findTx(txHash);
    } catch (error) {
      if (!isAbsenceFinal) throw error;

      this.logger.warn({ event: "DEPLOYMENT_DEPOSIT_TX_LOOKUP_FAILED", txHash, error });
      return null;
    }
  }

  async #settleByHash(txHash: string, result: { isSucceeded: boolean } | undefined): Promise<void> {
    const status = result?.isSucceeded ? "confirmed" : "void";
    const settledCount = await this.deploymentDepositRepository.settlePendingByTxHash(txHash, status);

    this.logger.info({ event: "DEPLOYMENT_DEPOSIT_RECONCILED", txHash, status, settledCount, isSeen: !!result });
  }

  /** The pooled endpoint can miss a landed tx on every attempt, so its absence voids the rows only once the chain index has passed their window without it. */
  async #waitForIndexToPassHash(txHash: string, latestBlockTime: Date | undefined, indexLagRetries: number): Promise<boolean> {
    const pending = await this.deploymentDepositRepository.findPendingByTxHash(txHash);

    if (!this.#isIndexBehind(pending, latestBlockTime) || indexLagRetries >= MAX_INDEX_LAG_RETRIES) return false;

    try {
      await this.jobQueueService.enqueue(new ReconcileDeploymentDeposit({ txHash, indexLagRetries: indexLagRetries + 1 }), {
        singletonKey: `${ReconcileDeploymentDeposit[JOB_NAME]}.${txHash}.${indexLagRetries + 1}`,
        startAfter: addMinutes(new Date(), INDEX_LAG_RETRY_DELAY_IN_MIN).toISOString()
      });
    } catch (error) {
      this.logger.error({ event: "DEPLOYMENT_DEPOSIT_INDEX_WAIT_FAILED", txHash, indexLagRetries, error });
      return false;
    }

    this.logger.warn({ event: "DEPLOYMENT_DEPOSIT_INDEX_BEHIND", txHash, latestBlockTime, indexLagRetries: indexLagRetries + 1 });
    return true;
  }

  /** The tip must be read before the lookup it judges, since the index stores a block with its transactions, so a tip past the window means that lookup saw them all. */
  #isIndexBehind(deposits: DeploymentDepositOutput[], latestBlockTime: Date | undefined): boolean {
    return deposits.some(deposit => !latestBlockTime || latestBlockTime < this.#landingWindowOf(deposit).until);
  }

  /** Rows are matched one at a time, so the chain deposit one row claims is no longer there for the next; a row holding a hash is left to its check by that hash. */
  async #reconcileByIndex({ depositIds, indexLagRetries = 0 }: IndexCheck, isAbsenceFinal: boolean): Promise<void> {
    const latestBlockTime = await this.deploymentSpendRepository.findLatestBlockTime();
    const unseen: DeploymentDepositOutput[] = [];

    for (const deposit of await this.deploymentDepositRepository.findPendingByIds(depositIds)) {
      if (deposit.txHash) continue;
      if (!(await this.#claimLanding(deposit))) unseen.push(deposit);
    }

    if (!unseen.length) {
      this.logger.info({ event: "DEPLOYMENT_DEPOSIT_RECONCILED", depositIds });
      return;
    }

    if (!isAbsenceFinal) {
      throw new Error(`Deposits ${unseen.map(({ id }) => id).join(", ")} are not in the chain index yet`);
    }

    await this.#voidUnlessIndexBehind(unseen, latestBlockTime, indexLagRetries);
  }

  /** A row the chain index has not reached yet waits for it a bounded number of times, so a landed deposit is not voided by index lag. */
  async #voidUnlessIndexBehind(unseen: DeploymentDepositOutput[], latestBlockTime: Date | undefined, indexLagRetries: number): Promise<void> {
    const depositIds = unseen.map(({ id }) => id);
    const isIndexBehind = this.#isIndexBehind(unseen, latestBlockTime);

    if (isIndexBehind && indexLagRetries < MAX_INDEX_LAG_RETRIES && (await this.#waitForIndex(depositIds, indexLagRetries + 1))) {
      this.logger.warn({ event: "DEPLOYMENT_DEPOSIT_INDEX_BEHIND", depositIds, latestBlockTime, indexLagRetries: indexLagRetries + 1 });
      return;
    }

    await this.deploymentDepositRepository.settlePending(depositIds, { status: "void" });
    this.logger.warn({ event: "DEPLOYMENT_DEPOSIT_VOIDED_UNSEEN", depositIds, isIndexBehind, indexLagRetries });
  }

  async #waitForIndex(depositIds: string[], indexLagRetries: number): Promise<boolean> {
    try {
      await this.jobQueueService.enqueue(new ReconcileDeploymentDeposit({ depositIds, indexLagRetries }), {
        singletonKey: `${ReconcileDeploymentDeposit[JOB_NAME]}.${depositIds[0]}.${indexLagRetries}`,
        startAfter: addMinutes(new Date(), INDEX_LAG_RETRY_DELAY_IN_MIN).toISOString()
      });
      return true;
    } catch (error) {
      this.logger.error({ event: "DEPLOYMENT_DEPOSIT_INDEX_WAIT_FAILED", depositIds, indexLagRetries, error });
      return false;
    }
  }

  async #claimLanding(deposit: DeploymentDepositOutput): Promise<boolean> {
    return await this.txService.transaction(async () => {
      await this.deploymentDepositRepository.lockDeployment(deposit);
      const landing = await this.#findLanding(deposit);

      if (landing) await this.deploymentDepositRepository.settlePending([deposit.id], { status: "confirmed", txHash: landing.txHash });

      return !!landing;
    });
  }

  async #findLanding(deposit: DeploymentDepositOutput): Promise<{ txHash?: string } | undefined> {
    const window = this.#landingWindowOf(deposit);

    if (deposit.kind === "deployment_create") {
      if (await this.deploymentDepositRepository.hasClaimedCreate(deposit)) return undefined;

      return (await this.deploymentSpendRepository.hasCreateLanded({ ...deposit, ...window })) ? {} : undefined;
    }

    const txHashes = await this.deploymentSpendRepository.findTopUpTxHashes({ ...deposit, ...window });
    const claimed = await this.deploymentDepositRepository.findClaimedTopUpTxHashes(deposit, txHashes);
    const txHash = txHashes.find(hash => !claimed.has(hash));

    return txHash ? { txHash } : undefined;
  }

  /** The row is written before signing and the chain refuses the unordered tx once its TTL passes after signing, so the deposit lands within this window or not at all. */
  #landingWindowOf({ createdAt }: DeploymentDepositOutput): LandingWindow {
    return {
      since: subMinutes(createdAt, LANDING_MARGIN_IN_MIN),
      until: addMinutes(addMilliseconds(createdAt, this.billingConfigService.get("TX_SIGNER_REQUEST_TIMEOUT_MS")), LANDING_MARGIN_IN_MIN)
    };
  }
}
