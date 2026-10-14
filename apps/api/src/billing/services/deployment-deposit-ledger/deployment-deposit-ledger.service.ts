import { Scope } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { millisecondsInMinute } from "date-fns/constants";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import {
  type AccountDepositMessage,
  type CreateDeploymentMessage,
  isCreateDeploymentMessage,
  isNonSpendingMessage,
  isSpendingMessage,
  parseCoinAmount
} from "@src/billing/lib/spending-messages/spending-messages";
import type { DeploymentDepositKind } from "@src/billing/model-schemas/deployment-deposit/deployment-deposit.schema";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import {
  type DeploymentDepositInput,
  type DeploymentDepositOutput,
  DeploymentDepositRepository
} from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ReconcileDeploymentDeposit } from "@src/billing/services/reconcile-deployment-deposit/reconcile-deployment-deposit.handler";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { PROJECT_FORBIDDEN_ERROR_CODE } from "@src/organization/services/organization-context/organization-context.resolver";
import { ProjectBudgetEnforcementService } from "@src/organization/services/project-budget-enforcement/project-budget-enforcement.service";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";

export type DepositRecordingOptions = {
  /** The project a create signed by its caller is filed into, which its deposit is judged against. */
  filingProjectId?: string;
};

export const INVALID_DEPOSIT_ERROR_CODE = "invalid_deposit";
export const UNSUPPORTED_MESSAGE_ERROR_CODE = "unsupported_message";
export const MESSAGE_SIGNER_MISMATCH_ERROR_CODE = "message_signer_mismatch";
export const UNSUPPORTED_DEPOSIT_DENOM_ERROR_CODE = "unsupported_deposit_denom";
export const DEPOSIT_PRICE_UNAVAILABLE_ERROR_CODE = "deposit_price_unavailable";

type DepositMessage = Pick<DeploymentDepositInput, "kind" | "owner" | "dseq" | "amount" | "denom">;

type SignedDeposit = DepositMessage & { signer: string };

type ParsedMessage = SignedDeposit | "malformed" | "unsupported" | undefined;

/** `isMalformed`: a spending message names no deployment or a whole amount; `hasUnsupported`: a message not known to move no deployment funds. */
type ParsedDeposits = { deposits: SignedDeposit[]; isMalformed: boolean; hasUnsupported: boolean };

type OrganizationWallet = UserWalletOutput & { organizationId: string };

/** `createdAt` is when signing started, kept for a row written after the broadcast so the chain index is matched against the right window. */
type UnpricedDeposit = Omit<DeploymentDepositInput, "amountCents"> & { createdAt: Date };

/** Rows written before signing, and deposits whose price is only read once the outcome is known, so pricing never delays the signer. */
export type PendingDeposits = { recorded: DeploymentDepositOutput[]; awaitingPrice: UnpricedDeposit[] };

type SignedTx = { code: number; hash: string };

const NO_PENDING_DEPOSITS: PendingDeposits = { recorded: [], awaitingPrice: [] };

const USD_PEGGED_DENOMS: readonly string[] = ["uact", "uusdc"];

const AKT_DENOM = "uakt";

const MICRO_UNITS_PER_CENT = 10_000n;

const WHOLE_NUMBER = /^\d+$/;

/** Past the signer's unordered-tx TTL, so the chain has settled a deposit's fate by the time it is asked. */
const RECONCILE_DELAY_IN_MIN = 5;

/** Writes every deposit the console signs; where budgets apply a failure to judge or record one refuses it, elsewhere it is logged. */
@singleton()
export class DeploymentDepositLedgerService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentDepositRepository: DeploymentDepositRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly denomExchangeService: DenomExchangeService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly executionContextService: ExecutionContextService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly projectBudgetEnforcementService: ProjectBudgetEnforcementService,
    @InjectTypeRegistry() private readonly registry: Registry,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DeploymentDepositLedgerService.name });
  }

  async recordPending(walletId: number, messages: readonly EncodeObject[], options: DepositRecordingOptions = {}): Promise<PendingDeposits> {
    const parsed = this.#parse(messages);

    if (isEmpty(parsed)) return NO_PENDING_DEPOSITS;

    const signingStartedAt = new Date();

    if (this.#isLegacyRequest()) {
      return await this.#recordBestEffort(walletId, () => this.#findWallet(walletId), parsed.deposits, options, signingStartedAt);
    }

    const wallet = await this.#findWallet(walletId);

    if (!wallet) return NO_PENDING_DEPOSITS;

    if (!(await this.#budgetsApplyTo(wallet))) {
      return await this.#recordBestEffort(walletId, async () => wallet, parsed.deposits, options, signingStartedAt);
    }

    const rows = await this.#pricedRowsOf(wallet, judgeable(parsed, wallet), options, signingStartedAt);
    const recorded = await this.projectBudgetEnforcementService.enforce(rows, () => this.#writePending(rows));

    return { recorded: recorded ?? [], awaitingPrice: [] };
  }

  /** Refuses before anything is written, for a caller that records a deployment ahead of signing it. */
  async assertWithinBudgets(walletId: number, messages: readonly EncodeObject[], options: DepositRecordingOptions = {}): Promise<void> {
    const parsed = this.#parse(messages);

    if (isEmpty(parsed) || this.#isLegacyRequest()) return;

    const wallet = await this.#findWallet(walletId);

    if (!wallet || !(await this.#budgetsApplyTo(wallet))) return;

    await this.projectBudgetEnforcementService.enforce(await this.#pricedRowsOf(wallet, judgeable(parsed, wallet), options, new Date()));
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

    if (!undecided.length || !error.txHash) return;

    try {
      await this.#checkByHash(undecided, error.txHash);
    } catch (reconcileError) {
      this.logger.error({ event: "DEPLOYMENT_DEPOSIT_RECONCILE_SCHEDULE_FAILED", txHash: error.txHash, error: reconcileError });
    }
  }

  #parse(messages: readonly EncodeObject[]): ParsedDeposits {
    const parsed: ParsedDeposits = { deposits: [], isMalformed: false, hasUnsupported: false };

    for (const message of messages) {
      const deposit = isSpendingMessage(message) ? depositOf(this.#asSigned(message)) : isNonSpendingMessage(message) ? undefined : "unsupported";

      if (deposit === "malformed") parsed.isMalformed = true;
      else if (deposit === "unsupported") parsed.hasUnsupported = true;
      else if (deposit) parsed.deposits.push(deposit);
    }

    return parsed;
  }

  /** The signer sends the message as the registry encodes it, so the fields are read back from those bytes; a message it cannot encode is never signed. */
  #asSigned<T extends CreateDeploymentMessage | AccountDepositMessage>(message: T): T | undefined {
    try {
      return { typeUrl: message.typeUrl, value: this.registry.decode({ typeUrl: message.typeUrl, value: this.registry.encode(message) }) } as T;
    } catch {
      return undefined;
    }
  }

  /** Never throws: no budget can apply on this path, so a row it failed to write must not stop the signer; akt is priced after the broadcast. */
  async #recordBestEffort(
    walletId: number,
    findWallet: () => Promise<OrganizationWallet | undefined>,
    deposits: SignedDeposit[],
    options: DepositRecordingOptions,
    signingStartedAt: Date
  ): Promise<PendingDeposits> {
    if (!deposits.length) return NO_PENDING_DEPOSITS;

    try {
      const wallet = await findWallet();

      if (!wallet) return NO_PENDING_DEPOSITS;

      const unpriced = await this.#unpricedRowsOf(wallet, deposits, options, signingStartedAt);
      const exact = unpriced.filter(({ denom }) => USD_PEGGED_DENOMS.includes(denom));

      const recorded = await this.txService.transaction(() => this.#writePending(exact.map(row => ({ ...row, amountCents: dollarPeggedCents(row.amount) }))));

      return { recorded, awaitingPrice: unpriced.filter(row => !exact.includes(row)) };
    } catch (error) {
      this.logger.error({ event: "DEPLOYMENT_DEPOSIT_RECORD_FAILED", walletId, error });
      return NO_PENDING_DEPOSITS;
    }
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

      return outcome.status === "pending"
        ? await this.txService.transaction(() => this.#writePending(pricedRows))
        : await this.deploymentDepositRepository.createMany(pricedRows);
    } catch (error) {
      this.logger.error({ event: "DEPLOYMENT_DEPOSIT_RECORD_FAILED", txHash: outcome.txHash, error });
      return [];
    }
  }

  /** A wallet outside every organization cannot fall under a project budget, so there is nothing to record or judge. */
  async #findWallet(walletId: number): Promise<OrganizationWallet | undefined> {
    const wallet = await this.userWalletRepository.findById(walletId);

    if (!wallet?.organizationId) {
      this.logger.debug({ event: "DEPLOYMENT_DEPOSIT_RECORD_SKIPPED", walletId, reason: "wallet_without_organization" });
      return undefined;
    }

    return { ...wallet, organizationId: wallet.organizationId };
  }

  async #unpricedRowsOf(wallet: OrganizationWallet, deposits: SignedDeposit[], options: DepositRecordingOptions, createdAt: Date): Promise<UnpricedDeposit[]> {
    const { organizationId } = wallet;
    const projectIds = await this.#projectIdsOf(organizationId, wallet.address, deposits, options);
    const actorUserId = this.#actorUserId();

    return deposits.map(({ signer: _signer, ...deposit }, index) => ({ ...deposit, organizationId, projectId: projectIds[index], actorUserId, createdAt }));
  }

  async #pricedRowsOf(
    wallet: OrganizationWallet,
    deposits: SignedDeposit[],
    options: DepositRecordingOptions,
    createdAt: Date
  ): Promise<DeploymentDepositInput[]> {
    const unpriced = await this.#unpricedRowsOf(wallet, deposits, options, createdAt);
    this.#assertWithinCallerProjects(unpriced);

    return await Promise.all(unpriced.map(async row => ({ ...row, amountCents: await this.#strictCents(row) })));
  }

  /** A caller limited to some projects moves funds only into deployments filed in a project it can write to. */
  #assertWithinCallerProjects(rows: UnpricedDeposit[]): void {
    const projectScope = this.#requestContext()?.projectScope;

    if (projectScope?.kind !== "projects") return;

    if (rows.some(({ projectId }) => !projectId || !projectScope.writableProjectIds.includes(projectId))) {
      throw createError(403, "A deposit goes into a deployment outside the projects this caller can write to", { errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
    }
  }

  /** A create counts where it is filed: its caller's filing project, else its record's, else the default; a top-up counts where its deployment is filed, else created. */
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
    const createdHere = new Set(own.filter(({ kind }) => kind === "deployment_create").map(({ dseq }) => dseq));
    const requestedCreateProjectOf = (dseq: string) => filingProjectId ?? filed.get(dseq) ?? undefined;
    const needsDefault = [...createdHere].some(dseq => !requestedCreateProjectOf(dseq));
    const defaultProjectId = needsDefault ? await this.#defaultProjectId(organizationId) : null;
    const createProjectOf = (dseq: string) => requestedCreateProjectOf(dseq) ?? defaultProjectId;
    const unfiledTopUps = own.filter(({ dseq }) => !filed.get(dseq) && !createdHere.has(dseq)).map(({ dseq }) => dseq);
    const createdEarlier = address
      ? await this.deploymentDepositRepository.findCreateProjectIds(organizationId, address, unfiledTopUps)
      : new Map<string, string>();
    const topUpProjectOf = (dseq: string) => filed.get(dseq) ?? (createdHere.has(dseq) ? createProjectOf(dseq) : createdEarlier.get(dseq)) ?? null;

    return deposits.map(({ owner, kind, dseq }) => {
      if (owner !== address) return null;

      return kind === "deployment_create" ? createProjectOf(dseq) : topUpProjectOf(dseq);
    });
  }

  async #defaultProjectId(organizationId: string): Promise<string | null> {
    return (await this.projectRepository.findDefaultByOrganizationId(organizationId))?.id ?? null;
  }

  #isLegacyRequest(): boolean {
    return this.#requestContext()?.mode === "legacy";
  }

  /** A request holds budgets in organization mode; a job holds them for a team's wallet always and for a personal one by its owner's flags. */
  async #budgetsApplyTo(wallet: OrganizationWallet): Promise<boolean> {
    const context = this.#requestContext();

    if (context) return context.mode === "organization";

    return (
      this.featureFlagsService.isEnabled(FeatureFlags.ORGANIZATIONS_ENFORCE) ||
      (await this.#isTeamWallet(wallet)) ||
      this.featureFlagsService.isEnabled(FeatureFlags.ORGANIZATIONS, { userId: wallet.userId ?? undefined })
    );
  }

  async #isTeamWallet({ organizationId }: OrganizationWallet): Promise<boolean> {
    return (await this.organizationRepository.findById(organizationId))?.type !== "personal";
  }

  #requestContext() {
    return this.executionContextService.hasContext() ? this.executionContextService.get("ORGANIZATION_CONTEXT") : undefined;
  }

  /** Only a request made by a signed-in member has an actor; jobs sign on the organization's behalf. */
  #actorUserId(): string | null {
    if (!this.#requestContext()) return null;

    return this.executionContextService.get("CURRENT_USER")?.id ?? null;
  }

  /** Where budgets apply, an amount that cannot be priced is refused rather than counted as nothing. */
  async #strictCents(deposit: UnpricedDeposit): Promise<number> {
    if (USD_PEGGED_DENOMS.includes(deposit.denom)) return dollarPeggedCents(deposit.amount);

    if (deposit.denom !== AKT_DENOM) {
      throw createError(400, `Deposits in ${deposit.denom} are not supported`, { errorCode: UNSUPPORTED_DEPOSIT_DENOM_ERROR_CODE });
    }

    const cents = await this.#aktCents(deposit);

    if (cents === undefined) {
      throw createError(503, "The deposit could not be priced, try again shortly", { errorCode: DEPOSIT_PRICE_UNAVAILABLE_ERROR_CODE });
    }

    return cents;
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

  async #writePending(rows: DeploymentDepositInput[]): Promise<DeploymentDepositOutput[]> {
    const written = await this.deploymentDepositRepository.createMany(rows);
    await this.#checkUnlessSettled(written);

    return written;
  }

  /** Every pending row is written with this check, which settles it against the chain index unless the signer or a check by its hash settles it first. */
  async #checkUnlessSettled(deposits: DeploymentDepositOutput[]): Promise<void> {
    if (!deposits.length) return;

    await this.jobQueueService.enqueue(new ReconcileDeploymentDeposit({ depositIds: deposits.map(({ id }) => id) }), {
      singletonKey: `${ReconcileDeploymentDeposit[JOB_NAME]}.unsettled.${deposits[0].id}`,
      startAfter: new Date(Date.now() + RECONCILE_DELAY_IN_MIN * millisecondsInMinute).toISOString()
    });
  }

  /** The rows' own checks skip a row holding a hash, so the hash and this check land together or not at all. */
  async #checkByHash(deposits: DeploymentDepositOutput[], txHash: string): Promise<void> {
    const depositIds = deposits.map(({ id }) => id);

    await this.txService.transaction(async () => {
      await this.deploymentDepositRepository.attachTxHash(depositIds, txHash);

      await this.jobQueueService.enqueue(new ReconcileDeploymentDeposit({ txHash }), {
        singletonKey: `${ReconcileDeploymentDeposit[JOB_NAME]}.${txHash}`,
        startAfter: new Date(Date.now() + RECONCILE_DELAY_IN_MIN * millisecondsInMinute).toISOString()
      });
    });
  }
}

function dollarPeggedCents(amount: string): number {
  return Number((BigInt(amount) + MICRO_UNITS_PER_CENT / 2n) / MICRO_UNITS_PER_CENT);
}

function isEmpty({ deposits, isMalformed, hasUnsupported }: ParsedDeposits): boolean {
  return !deposits.length && !isMalformed && !hasUnsupported;
}

/** Where a budget may apply, a message the ledger cannot read exactly as the chain will, or one moving another account's funds, is refused. */
function judgeable({ deposits, isMalformed, hasUnsupported }: ParsedDeposits, wallet: OrganizationWallet): SignedDeposit[] {
  if (hasUnsupported) {
    throw createError(400, "The request holds a message that cannot be signed in an organization", { errorCode: UNSUPPORTED_MESSAGE_ERROR_CODE });
  }

  if (isMalformed) {
    throw createError(400, "A deposit names no deployment or carries an amount that is not a whole number", { errorCode: INVALID_DEPOSIT_ERROR_CODE });
  }

  if (deposits.some(({ owner, signer }) => owner !== wallet.address || signer !== wallet.address)) {
    throw createError(403, "A deposit acts for another account than the organization's wallet", { errorCode: MESSAGE_SIGNER_MISMATCH_ERROR_CODE });
  }

  return deposits;
}

function depositOf(message: CreateDeploymentMessage | AccountDepositMessage | undefined): ParsedMessage {
  if (!message) return "malformed";

  if (isCreateDeploymentMessage(message)) {
    const { id, deposit } = message.value;

    return depositIn("deployment_create", { owner: id?.owner, dseq: id?.dseq?.toString(), signer: id?.owner }, deposit?.amount);
  }

  const { signer, id, deposit } = message.value;

  if (id?.scope !== Scope.deployment) return "unsupported";

  const [owner, dseq, ...rest] = id.xid.split("/");

  return rest.length ? "malformed" : depositIn("top_up", { owner, dseq, signer }, deposit?.amount);
}

/** A spending message without a coin moves nothing; one whose coin or deployment the chain would read differently is malformed. */
function depositIn(
  kind: DeploymentDepositKind,
  { owner, dseq, signer }: { owner: string | undefined; dseq: string | undefined; signer: string | undefined },
  coin: { denom: string; amount: string } | undefined
): ParsedMessage {
  if (!coin) return undefined;

  const amount = parseCoinAmount(coin.amount);

  if (!owner || !signer || !dseq || !WHOLE_NUMBER.test(dseq) || amount === undefined) return "malformed";

  return amount === 0n ? undefined : { kind, owner, dseq, signer, amount: coin.amount, denom: coin.denom };
}
