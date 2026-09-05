import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { LeaseHttpService } from "@akashnetwork/http-sdk";
import { Trace, withSpan } from "@akashnetwork/instrumentation";
import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { IndexedTx } from "@cosmjs/stargate";
import { context, trace } from "@opentelemetry/api";
import assert from "http-assert";
import createError, { BadRequest, isHttpError } from "http-errors";
import pick from "lodash/pick";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import { TrialDeploymentLeaseCreated } from "@src/billing/events/trial-deployment-lease-created";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { RecordDeploymentSetting, recordDeploymentSettingKeyFor } from "@src/deployment/services/record-deployment-setting/record-deployment-setting.handler";
import { UserRepository } from "@src/user/repositories";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";
import { BalancesService } from "../balances/balances.service";
import { BillingConfigService } from "../billing-config/billing-config.service";
import { ChainErrorService } from "../chain-error/chain-error.service";
import { DeploymentDepositRefusalCache, isInsufficient } from "../deployment-deposit-refusal-cache/deployment-deposit-refusal-cache.service";
import { TrialValidationService } from "../trial-validation/trial-validation.service";

type StringifiedEncodeObject = Omit<EncodeObject, "value"> & { value: string };

const SPENDING_TXS = [MsgCreateDeployment, MsgAccountDeposit];

const INSUFFICIENT_DEPOSIT_BALANCE_MESSAGE = "Not enough balance to cover the deployment deposit. Add credits or turn on auto recharge to continue.";
const INSUFFICIENT_DEPOSIT_BALANCE_RELOADING_MESSAGE =
  "Not enough balance to cover the deployment deposit. A top up from your saved payment method is on the way, so try again in a moment.";

@singleton()
export class ManagedSignerService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    @InjectTypeRegistry() private readonly registry: Registry,
    private readonly billingConfigService: BillingConfigService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository,
    private readonly balancesService: BalancesService,
    private readonly authService: AuthService,
    private readonly chainErrorService: ChainErrorService,
    private readonly anonymousValidateService: TrialValidationService,
    private readonly txManagerService: TxManagerService,
    private readonly domainEvents: DomainEventsService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly trialActivationJobService: TrialActivationJobService,
    private readonly depositRefusalCache: DeploymentDepositRefusalCache,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ManagedSignerService.name });
  }

  @Trace()
  async executeDerivedTx(walletIndex: number, messages: readonly EncodeObject[]) {
    try {
      const granter = await this.txManagerService.getFundingWalletAddress();
      return await this.txManagerService.signAndBroadcastWithDerivedWallet(walletIndex, messages, {
        fee: { granter }
      });
    } catch (error: any) {
      throw await this.chainErrorService.toAppError(error, messages);
    }
  }

  @Trace()
  async executeFundingTx(messages: readonly EncodeObject[]) {
    try {
      return await this.txManagerService.signAndBroadcastWithFundingWallet(messages);
    } catch (error: any) {
      throw await this.chainErrorService.toAppError(error, messages);
    }
  }

  async executeDerivedEncodedTxByUserId(userId: UserWalletOutput["userId"], messages: StringifiedEncodeObject[]) {
    const decoded = this.decodeMessages(messages);
    return await this.executeDerivedDecodedTxByUserId(userId, decoded);
  }

  @Trace()
  async executeDerivedDecodedTxByUserId(
    userId: UserWalletOutput["userId"],
    messages: EncodeObject[]
  ): Promise<{
    code: number;
    hash: string;
    transactionHash: string;
    rawLog: string;
  }> {
    assert(userId, 404, "User Not Found");

    const userWallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "sign").findOneByUserId(userId);
    assert(userWallet, 404, "UserWallet Not Found");

    return this.executeDecodedTxByUserWallet(userWallet, messages);
  }

  @Trace()
  async executeDecodedTxByUserWallet(
    userWallet: UserWalletOutput,
    messages: EncodeObject[]
  ): Promise<{
    code: number;
    hash: string;
    transactionHash: string;
    rawLog: string;
  }> {
    await this.#assertActivatedForSpending(userWallet, messages);
    await this.#validateBalances(userWallet, messages);
    await Promise.all([
      this.anonymousValidateService.validateLeaseProvidersAuditors(messages, userWallet),
      this.anonymousValidateService.validateDeploymentGpuModels(messages, userWallet),
      this.anonymousValidateService.validateDeploymentGpuInterconnect(messages, userWallet),
      this.anonymousValidateService.validateDeploymentResources(messages, userWallet),
      this.anonymousValidateService.validateLeaseGpuModels(messages, userWallet)
    ]);

    const createLeaseMessage: { typeUrl: string; value: MsgCreateLease } | undefined = messages.find(message => message.typeUrl.endsWith(".MsgCreateLease"));
    const hasCreateTrialLeaseMessage = userWallet.isTrialing && !!createLeaseMessage;
    const hasLeases = hasCreateTrialLeaseMessage ? await this.leaseHttpService.hasLeases(userWallet.address!) : null;

    let tx: Awaited<ReturnType<ManagedSignerService["executeDerivedTx"]>>;

    try {
      tx = await this.executeDerivedTx(userWallet.id, messages);

      if (tx.code !== COSMOS_TX_CODE_OK) {
        this.logger.error({ event: "TX_LANDED_WITH_NON_ZERO_CODE", txHash: tx.hash, code: tx.code, rawLog: tx.rawLog });
        throw await this.chainErrorService.toAppError(new Error(tx.rawLog || `tx ${tx.hash} failed on-chain with code ${tx.code}`), messages);
      }
    } catch (error) {
      await this.#scheduleReloadOnPaymentRequired(error, userWallet);
      throw error;
    }

    if (hasCreateTrialLeaseMessage) {
      await this.domainEvents.publish(
        new TrialDeploymentLeaseCreated({
          walletId: userWallet.id,
          dseq: createLeaseMessage.value.bidId!.dseq.toString(),
          createdAt: new Date().toISOString(),
          isFirstLease: !hasLeases
        })
      );
    }

    if (createLeaseMessage) {
      await this.domainEvents.publish(
        new EnableDeploymentAlertCommand({
          userId: userWallet.userId,
          walletAddress: userWallet.address!,
          dseq: createLeaseMessage.value.bidId!.dseq.toString()
        })
      );

      if (!userWallet.isTrialing) {
        const dseq = createLeaseMessage.value.bidId!.dseq.toString();
        await this.domainEvents.publish(
          new FundDeploymentCommand({
            walletId: userWallet.id,
            address: userWallet.address!,
            dseq
          }),
          { singletonKey: `${FundDeploymentCommand.name}.${dseq}.${userWallet.id}` }
        );
      }
    }

    await this.#recordCreatedDeployments(userWallet, messages);

    await this.balancesService.refreshUserWalletLimits(userWallet);
    await this.#ensureAutoReloadSchedule(userWallet.userId, messages);
    await this.#scheduleCreditsLowCheckOnClose(userWallet, messages);

    const result = pick(tx, ["code", "hash", "transactionHash", "rawLog"]) as Pick<IndexedTx, "code" | "hash" | "rawLog">;

    if (result.hash) {
      return {
        ...result,
        transactionHash: result.hash
      };
    }

    return result as Pick<IndexedTx, "code" | "hash" | "rawLog"> & { transactionHash: string };
  }

  /** A create broadcast here never passes through the deployment API that would record it, so the record is written from the landed transaction. */
  async #recordCreatedDeployments(userWallet: UserWalletOutput, messages: EncodeObject[]) {
    const createdDseqs = messages
      .filter((message): message is { typeUrl: string; value: MsgCreateDeployment } => message.typeUrl.endsWith(".MsgCreateDeployment"))
      .map(message => message.value.id?.dseq)
      .filter(dseq => dseq !== undefined);

    for (const dseq of createdDseqs) {
      const key = { userId: userWallet.userId, dseq: dseq.toString() };
      await this.domainEvents.publish(new RecordDeploymentSetting(key), { singletonKey: recordDeploymentSettingKeyFor(key) });
    }
  }

  async #ensureAutoReloadSchedule(userId: UserWalletOutput["userId"], messages: EncodeObject[]) {
    if (this.#hasSpendingTx(messages)) {
      await this.walletReloadJobService.scheduleImmediate({ userId });
    }
  }

  /** Best-effort: a schedule failure must never fail a close that already landed on chain. */
  async #scheduleCreditsLowCheckOnClose(userWallet: UserWalletOutput, messages: EncodeObject[]) {
    if (!messages.some(message => message.typeUrl.endsWith(".MsgCloseDeployment"))) {
      return;
    }

    try {
      await this.walletReloadJobService.scheduleCreditsLowCheckIfAutoReloadOff({ walletId: userWallet.id });
    } catch (error) {
      this.logger.error({ event: "CREDITS_LOW_CHECK_ON_CLOSE_SCHEDULE_FAILED", walletId: userWallet.id, error });
    }
  }

  #hasSpendingTx(messages: EncodeObject[]): boolean {
    return messages.some(message => SPENDING_TXS.some(msg => message.typeUrl.endsWith(msg.$type)));
  }

  /**
   * A managed wallet gets its address at registration but can only broadcast a spending tx once the trial is
   * activated and its on-chain grants are provisioned (in the background, see {@link WalletInitializerService}).
   * When a spend arrives before then we re-request activation (a self-heal for a wallet whose proactive job never
   * ran) and reject with a retriable 409, so the client waits for provisioning instead of surfacing the terminal
   * chain error a missing grant would otherwise produce.
   */
  async #assertActivatedForSpending(userWallet: UserWalletOutput, messages: EncodeObject[]) {
    if (!this.#hasSpendingTx(messages)) return;

    await this.trialActivationJobService.assertActivated(userWallet);
  }

  /** Fee allowance always comes from the chain and the deployment allowance only when a create is present, since the row can lag behind the chain. */
  async #validateBalances(userWallet: UserWalletOutput, messages: EncodeObject[]) {
    return withSpan("ManagedSignerService.validateBalances", async () => {
      const createDeploymentMessages = this.#getCreateDeploymentMessages(messages);
      const hasDeploymentMessage = createDeploymentMessages.length > 0;
      const requiredDeposit = this.#sumDepositsDrawnFromGrant(createDeploymentMessages);

      if (hasDeploymentMessage) {
        await this.#refuseFromCache(userWallet, requiredDeposit);
      }

      const [feeAllowance, deploymentAllowance] = await Promise.all([
        this.ensureFeeGrants(userWallet),
        !hasDeploymentMessage ? Promise.resolve(userWallet.deploymentAllowance) : this.balancesService.retrieveDeploymentLimit(userWallet)
      ]);

      assert(feeAllowance > 0, 402, "Not enough funds to cover the transaction fee");

      if (hasDeploymentMessage && isInsufficient(deploymentAllowance, requiredDeposit)) {
        const reloadScheduled = await this.#scheduleReloadForInsufficientBalance(userWallet);
        const { retryAfterSeconds } = this.depositRefusalCache.remember(userWallet, { chainDeploymentAllowance: deploymentAllowance, reloadScheduled });

        this.logger.warn({
          event: "DEPLOYMENT_CREATE_REFUSED_INSUFFICIENT_ALLOWANCE",
          userId: userWallet.userId,
          address: userWallet.address,
          deploymentAllowance,
          requiredDeposit,
          reloadScheduled
        });

        this.#throwInsufficientDepositBalance(reloadScheduled, retryAfterSeconds);
      }
    });
  }

  /** Re-serves a recent refusal until a funding path rewrites the wallet row, still requesting one reload if auto recharge was off at the first refusal. */
  async #refuseFromCache(userWallet: UserWalletOutput, requiredDeposit: number): Promise<void> {
    const cached = this.depositRefusalCache.find(userWallet, requiredDeposit);

    if (!cached) {
      return;
    }

    let reloadScheduled = cached.reloadScheduled;

    if (!reloadScheduled) {
      reloadScheduled = await this.#scheduleReloadForInsufficientBalance(userWallet);

      if (reloadScheduled) {
        this.depositRefusalCache.markReloadScheduled(userWallet.userId);
      }
    }

    this.logger.debug({
      event: "DEPLOYMENT_CREATE_REFUSED_FROM_CACHE",
      userId: userWallet.userId,
      deploymentAllowance: cached.chainDeploymentAllowance,
      requiredDeposit,
      reloadScheduled,
      suppressedAttempts: cached.suppressedAttempts
    });

    this.#throwInsufficientDepositBalance(reloadScheduled, cached.retryAfterSeconds);
  }

  #throwInsufficientDepositBalance(reloadScheduled: boolean, retryAfterSeconds: number): never {
    const message = reloadScheduled ? INSUFFICIENT_DEPOSIT_BALANCE_RELOADING_MESSAGE : INSUFFICIENT_DEPOSIT_BALANCE_MESSAGE;

    throw createError(402, message, { headers: { "Retry-After": String(retryAfterSeconds) } });
  }

  #getCreateDeploymentMessages(messages: EncodeObject[]): { typeUrl: string; value: MsgCreateDeployment }[] {
    return messages.filter((message): message is { typeUrl: string; value: MsgCreateDeployment } => message.typeUrl.endsWith(".MsgCreateDeployment"));
  }

  /**
   * A create deposit is drawn purely from the deployment grant, so the deposits in the batch are directly
   * comparable to the grant's remaining spend limit. Comparing against the real amount rather than a bare `> 0`
   * refuses the request here instead of several seconds later in chain simulation, where the shortfall surfaces
   * as an opaque 402.
   *
   * Only positive deposits count. `/v1/tx` takes a caller-supplied batch and the request schema does not
   * constrain the deposit's sign, so summing raw values would let a negative deposit offset a positive one and
   * understate what the chain is about to charge against the grant. The chain rejects the negative message and
   * fails the whole tx anyway; this keeps the sum a true lower bound instead of a bypass of the check.
   */
  #sumDepositsDrawnFromGrant(createDeploymentMessages: { value: MsgCreateDeployment }[]): number {
    const denom = this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM");

    return createDeploymentMessages.reduce((total, message) => {
      const deposit = message.value.deposit?.amount;

      if (deposit?.denom !== denom) {
        return total;
      }

      return total + Math.max(0, Number(deposit.amount));
    }, 0);
  }

  /**
   * Refills the balance for a spend the chain refused even though the pre-flight check passed: auto-funding can
   * drain the grant in the window between the two. The reload check itself decides whether a charge is due.
   */
  async #scheduleReloadOnPaymentRequired(error: unknown, userWallet: UserWalletOutput): Promise<void> {
    if (!isHttpError(error) || error.status !== 402) {
      return;
    }

    await this.#scheduleReloadForInsufficientBalance(userWallet);
  }

  /**
   * Refills the balance the refused request could not cover, so a user with auto recharge on can retry instead of
   * topping up by hand. Scheduling failures are swallowed: the caller is about to receive a clean 402 and turning
   * that into a 500 would lose the actionable message. The returned flag reports whether auto recharge is on.
   *
   * `triggeredByDeployment` is required here: the refused request is a create, so the owner may hold no active
   * deployment yet. Without it the reload check skips on its indexer-fed active-deployment guard and never charges,
   * leaving the caller with a 402 promising a top-up that never arrives.
   */
  async #scheduleReloadForInsufficientBalance(userWallet: UserWalletOutput): Promise<boolean> {
    try {
      return await this.walletReloadJobService.scheduleImmediate({ userId: userWallet.userId }, { triggeredByDeployment: true });
    } catch (error) {
      this.logger.error({ event: "INSUFFICIENT_BALANCE_RELOAD_SCHEDULE_FAILED", userId: userWallet.userId, error });
      return false;
    }
  }

  async ensureFeeGrants(wallet: Pick<UserWalletOutput, "address" | "isTrialing" | "createdAt" | "activatedAt">): Promise<number> {
    return withSpan("ManagedSignerService.ensureFeeGrants", async () => {
      let feeAllowance = await this.balancesService.retrieveAndCalcFeeLimit(wallet);
      const needsRefill = feeAllowance < this.billingConfigService.get("FEE_ALLOWANCE_REFILL_THRESHOLD");

      const span = trace.getSpan(context.active());
      span?.setAttribute("balance.feeAllowance", feeAllowance);
      span?.setAttribute("balance.needsRefill", needsRefill);

      if (needsRefill) {
        await this.managedUserWalletService.refillWalletFees(this, wallet);
        feeAllowance = await this.balancesService.retrieveAndCalcFeeLimit(wallet);
      }

      return feeAllowance;
    });
  }

  private decodeMessages(messages: StringifiedEncodeObject[]): EncodeObject[] {
    return messages.map((message, index) => {
      const value = new Uint8Array(Buffer.from(message.value, "base64"));

      try {
        return {
          typeUrl: message.typeUrl,
          value: this.registry.decode({ value, typeUrl: message.typeUrl })
        };
      } catch (error) {
        this.logger.error({
          event: "TX_MESSAGE_DECODE_FAILED",
          index,
          typeUrl: message.typeUrl,
          valueLength: value.length,
          bytePrefix: Buffer.from(value.subarray(0, 8)).toString("hex"),
          error
        });

        throw new BadRequest(`Failed to decode message at index ${index} (typeUrl: ${message.typeUrl})`);
      }
    });
  }
}
