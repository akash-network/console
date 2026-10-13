import { type MsgAccountDeposit, Scope } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { millisecondsInMinute } from "date-fns/constants";
import { inject, singleton } from "tsyringe";

import type { DeploymentDepositKind } from "@src/billing/model-schemas/deployment-deposit/deployment-deposit.schema";
import {
  type DeploymentDepositInput,
  type DeploymentDepositOutput,
  DeploymentDepositRepository
} from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ReconcileDeploymentDeposit } from "@src/billing/services/reconcile-deployment-deposit/reconcile-deployment-deposit.handler";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";

export type DepositRecordingOptions = {
  /** The project a create signed by its caller will be filed into once its record is written after the broadcast. */
  filingProjectId?: string;
};

type DepositMessage = Pick<DeploymentDepositInput, "kind" | "owner" | "dseq" | "amount" | "denom">;

/** `createdAt` is when signing started, kept for a row written after the broadcast so the chain index is matched against the right window. */
type UnpricedDeposit = Omit<DeploymentDepositInput, "amountCents"> & { createdAt: Date };

/** Rows written before signing, and deposits whose price is only read once the outcome is known, so pricing never delays the signer. */
export type PendingDeposits = { recorded: DeploymentDepositOutput[]; awaitingPrice: UnpricedDeposit[] };

type SignedTx = { code: number; hash: string };

const NO_PENDING_DEPOSITS: PendingDeposits = { recorded: [], awaitingPrice: [] };

const USD_PEGGED_DENOMS: readonly string[] = ["uact", "uusdc"];

const AKT_DENOM = "uakt";

const MICRO_UNITS_PER_CENT = 10_000n;

/** Past the signer's unordered-tx TTL, so the chain has settled a deposit's fate by the time it is asked. */
const RECONCILE_DELAY_IN_MIN = 5;

/** Writes every deposit the console signs, so committed spend is known per project before the chain index catches up. */
@singleton()
export class DeploymentDepositLedgerService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentDepositRepository: DeploymentDepositRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly denomExchangeService: DenomExchangeService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly executionContextService: ExecutionContextService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DeploymentDepositLedgerService.name });
  }

  /** Never throws: the ledger reports spend, and a row it failed to write must not stop the signer. */
  async recordPending(walletId: number, messages: readonly EncodeObject[], options: DepositRecordingOptions = {}): Promise<PendingDeposits> {
    const deposits = findDepositMessages(messages);

    if (!deposits.length) return NO_PENDING_DEPOSITS;

    const signingStartedAt = new Date();

    try {
      const unpriced = await this.#unpricedRowsOf(walletId, deposits, options, signingStartedAt);
      const exact = unpriced.filter(({ denom }) => USD_PEGGED_DENOMS.includes(denom));

      return {
        recorded: await this.deploymentDepositRepository.createMany(exact.map(row => ({ ...row, amountCents: dollarPeggedCents(row.amount) }))),
        awaitingPrice: unpriced.filter(row => !exact.includes(row))
      };
    } catch (error) {
      this.logger.error({ event: "DEPLOYMENT_DEPOSIT_RECORD_FAILED", walletId, error });
      return NO_PENDING_DEPOSITS;
    }
  }

  async recordLanded({ recorded, awaitingPrice }: PendingDeposits, tx: SignedTx): Promise<void> {
    const isConfirmed = tx.code === COSMOS_TX_CODE_OK;
    await this.#settle(recorded, isConfirmed ? "confirmed" : "void", tx.hash);

    if (isConfirmed) {
      await this.#recordPriced(awaitingPrice, { status: "confirmed", txHash: tx.hash });
    }
  }

  /** Only a failure that proves nothing landed voids the rows; one the signer could not decide keeps them pending until a check settles them. */
  async recordFailed({ recorded, awaitingPrice }: PendingDeposits, error: unknown): Promise<void> {
    if (!isUnknownTxOutcome(error)) {
      await this.#settle(recorded, "void");
      return;
    }

    const undecided = [...recorded, ...(await this.#recordPriced(awaitingPrice, { status: "pending" }))];

    if (!undecided.length) return;

    try {
      await this.#awaitReconciliation(undecided, error.txHash);
    } catch (reconcileError) {
      this.logger.error({ event: "DEPLOYMENT_DEPOSIT_RECONCILE_SCHEDULE_FAILED", txHash: error.txHash, error: reconcileError });
    }
  }

  async #unpricedRowsOf(walletId: number, deposits: DepositMessage[], options: DepositRecordingOptions, createdAt: Date): Promise<UnpricedDeposit[]> {
    const wallet = await this.userWalletRepository.findById(walletId);

    if (!wallet?.organizationId) {
      this.logger.debug({ event: "DEPLOYMENT_DEPOSIT_RECORD_SKIPPED", walletId, reason: "wallet_without_organization" });
      return [];
    }

    const { organizationId } = wallet;
    const projectIds = await this.#projectIdsOf(organizationId, wallet.address, deposits, options);
    const actorUserId = this.#actorUserId();

    return deposits.map((deposit, index) => ({ ...deposit, organizationId, projectId: projectIds[index], actorUserId, createdAt }));
  }

  /** Never throws: the outcome is already known, and a deposit that cannot be priced is left out rather than counted as nothing. */
  async #recordPriced(deposits: UnpricedDeposit[], outcome: Pick<DeploymentDepositInput, "status" | "txHash">): Promise<DeploymentDepositOutput[]> {
    if (!deposits.length) return [];

    try {
      const priced = await Promise.all(deposits.map(async deposit => ({ ...deposit, ...outcome, amountCents: await this.#aktCents(deposit) })));
      const pricedRows = priced.filter((row): row is typeof row & { amountCents: number } => row.amountCents !== undefined);

      if (pricedRows.length < priced.length) {
        this.logger.warn({ event: "DEPLOYMENT_DEPOSIT_UNPRICED", dseqs: priced.filter(row => row.amountCents === undefined).map(({ dseq }) => dseq) });
      }

      return await this.deploymentDepositRepository.createMany(pricedRows);
    } catch (error) {
      this.logger.error({ event: "DEPLOYMENT_DEPOSIT_RECORD_FAILED", txHash: outcome.txHash, error });
      return [];
    }
  }

  /** A deposit into another owner's deployment belongs to no project here; a create not yet recorded goes where its record will be filed. */
  async #projectIdsOf(
    organizationId: string,
    address: string | null,
    deposits: DepositMessage[],
    { filingProjectId }: DepositRecordingOptions
  ): Promise<Array<string | null>> {
    const own = deposits.filter(deposit => deposit.owner === address);
    const filed = await this.deploymentSettingRepository.findProjectIdsInOrganizationByDseqs(
      organizationId,
      own.map(({ dseq }) => dseq)
    );
    const isUnfiledCreate = (deposit: DepositMessage) => deposit.kind === "deployment_create" && !filed.has(deposit.dseq);
    const unfiledCreateProjectId = own.some(isUnfiledCreate) ? filingProjectId ?? (await this.#defaultProjectId(organizationId)) : null;

    return deposits.map(deposit => {
      if (deposit.owner !== address) return null;

      return isUnfiledCreate(deposit) ? unfiledCreateProjectId : filed.get(deposit.dseq) ?? null;
    });
  }

  async #defaultProjectId(organizationId: string): Promise<string | null> {
    return (await this.projectRepository.findDefaultByOrganizationId(organizationId))?.id ?? null;
  }

  /** Only a request made by a signed-in member has an actor; jobs sign on the organization's behalf. */
  #actorUserId(): string | null {
    if (!this.executionContextService.hasContext() || !this.executionContextService.get("ORGANIZATION_CONTEXT")) return null;

    return this.executionContextService.get("CURRENT_USER")?.id ?? null;
  }

  async #aktCents({ amount, denom }: UnpricedDeposit): Promise<number | undefined> {
    if (denom !== AKT_DENOM) return undefined;

    const { price } = await this.denomExchangeService.getExchangeRateToUSD("akt");

    return Number.isFinite(price) && price > 0 ? Math.round((Number(amount) * price) / Number(MICRO_UNITS_PER_CENT)) : undefined;
  }

  /** Never throws: the transaction's outcome is already decided and a failed write only leaves the rows pending. */
  async #settle(deposits: DeploymentDepositOutput[], status: "confirmed" | "void", txHash?: string): Promise<void> {
    if (!deposits.length) return;

    try {
      await this.deploymentDepositRepository.settlePending(
        deposits.map(({ id }) => id),
        { status, txHash }
      );
    } catch (error) {
      this.logger.error({ event: "DEPLOYMENT_DEPOSIT_SETTLE_FAILED", status, txHash, error });
    }
  }

  /** A row the signer gave no hash for is matched against the chain index instead, so no undecided row stays pending past its check. */
  async #awaitReconciliation(deposits: DeploymentDepositOutput[], txHash: string | undefined): Promise<void> {
    const depositIds = deposits.map(({ id }) => id);
    const job = txHash ? new ReconcileDeploymentDeposit({ txHash }) : new ReconcileDeploymentDeposit({ depositIds });

    await this.txService.transaction(async () => {
      if (txHash) await this.deploymentDepositRepository.attachTxHash(depositIds, txHash);

      await this.jobQueueService.enqueue(job, {
        singletonKey: `${ReconcileDeploymentDeposit[JOB_NAME]}.${txHash ?? depositIds[0]}`,
        startAfter: new Date(Date.now() + RECONCILE_DELAY_IN_MIN * millisecondsInMinute).toISOString()
      });
    });
  }
}

function dollarPeggedCents(amount: string): number {
  return Number((BigInt(amount) + MICRO_UNITS_PER_CENT / 2n) / MICRO_UNITS_PER_CENT);
}

function findDepositMessages(messages: readonly EncodeObject[]): DepositMessage[] {
  return messages.flatMap(message => {
    if (message.typeUrl.endsWith(".MsgCreateDeployment")) {
      const { id, deposit } = message.value as MsgCreateDeployment;

      return toDepositMessage("deployment_create", id?.owner, id?.dseq?.toString(), deposit?.amount);
    }

    if (message.typeUrl.endsWith(".MsgAccountDeposit")) {
      const { id, deposit } = message.value as MsgAccountDeposit;
      const [owner, dseq] = id?.scope === Scope.deployment ? id.xid.split("/") : [];

      return toDepositMessage("top_up", owner, dseq, deposit?.amount);
    }

    return [];
  });
}

function toDepositMessage(
  kind: DeploymentDepositKind,
  owner: string | undefined,
  dseq: string | undefined,
  coin: { denom: string; amount: string } | undefined
): DepositMessage[] {
  if (!owner || !dseq || !coin || !/^\d+$/.test(coin.amount) || BigInt(coin.amount) <= 0n) return [];

  return [{ kind, owner, dseq, amount: coin.amount, denom: coin.denom }];
}
