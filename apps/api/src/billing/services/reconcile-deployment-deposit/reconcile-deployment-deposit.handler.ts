import { addMilliseconds, addMinutes, subMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type DeploymentDepositOutput, DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import { DeploymentSpendRepository, type LandingWindow } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
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

/** Must stay above tx-signer's UNORDERED_TX_TTL_MS, since a deposit signed as TX_SIGNER_REQUEST_TIMEOUT_MS runs out can still land that long after. */
const LANDING_MARGIN_IN_MIN = 1;

/** How often a check waits for a chain index that has not reached the deposits' window yet before it voids them. */
const MAX_INDEX_LAG_RETRIES = 6;

const INDEX_LAG_RETRY_DELAY_IN_MIN = 10;

type IndexCheck = { depositIds: string[]; indexLagRetries?: number };

/** Settles the ledger rows of a deposit the signer left undecided: by its hash when the signer gave one, else by the chain index. */
export class ReconcileDeploymentDeposit implements Job {
  static readonly [JOB_NAME] = "ReconcileDeploymentDeposit";
  readonly name = ReconcileDeploymentDeposit[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { txHash: string } | IndexCheck) {}
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

  /** Absence is asked again while retries remain, since a pooled endpoint can lag; the last attempt runs long past the signer's TTL, so absence there voids the rows. */
  async handle(payload: JobPayload<ReconcileDeploymentDeposit>, job?: JobMeta): Promise<void> {
    const isLastAttempt = !job || job.retryCount >= job.retryLimit;

    if ("txHash" in payload) {
      await this.#reconcileByHash(payload.txHash, isLastAttempt);
      return;
    }

    await this.#reconcileByIndex(payload, isLastAttempt);
  }

  async #reconcileByHash(txHash: string, isLastAttempt: boolean): Promise<void> {
    const tx = await this.txPresenceService.findTx(txHash);

    if (!tx && !isLastAttempt) {
      throw new Error(`Deposit transaction ${txHash} is not visible on chain yet`);
    }

    const status = tx?.code === COSMOS_TX_CODE_OK ? "confirmed" : "void";
    const settledCount = await this.deploymentDepositRepository.settlePendingByTxHash(txHash, status);

    this.logger.info({ event: "DEPLOYMENT_DEPOSIT_RECONCILED", txHash, status, settledCount, isSeen: !!tx });
  }

  /** Rows are matched one at a time, so the chain deposit one row claims is no longer there for the next; a row holding a hash is left to its check by that hash. */
  async #reconcileByIndex({ depositIds, indexLagRetries = 0 }: IndexCheck, isLastAttempt: boolean): Promise<void> {
    const unseen: DeploymentDepositOutput[] = [];

    for (const deposit of await this.deploymentDepositRepository.findPendingByIds(depositIds)) {
      if (deposit.txHash) continue;
      if (!(await this.#claimLanding(deposit))) unseen.push(deposit);
    }

    if (!unseen.length) {
      this.logger.info({ event: "DEPLOYMENT_DEPOSIT_RECONCILED", depositIds });
      return;
    }

    if (!isLastAttempt) {
      throw new Error(`Deposits ${unseen.map(({ id }) => id).join(", ")} are not in the chain index yet`);
    }

    await this.#voidUnlessIndexBehind(unseen, indexLagRetries);
  }

  /** A row the chain index has not reached yet waits for it a bounded number of times, so a landed deposit is not voided by index lag. */
  async #voidUnlessIndexBehind(unseen: DeploymentDepositOutput[], indexLagRetries: number): Promise<void> {
    const depositIds = unseen.map(({ id }) => id);
    const latestBlockTime = await this.deploymentSpendRepository.findLatestBlockTime();
    const isIndexBehind = unseen.some(deposit => !latestBlockTime || latestBlockTime < this.#landingWindowOf(deposit).until);

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
