import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { LeaseHttpService } from "@akashnetwork/http-sdk";
import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { IndexedTx } from "@cosmjs/stargate";
import { context, trace } from "@opentelemetry/api";
import assert from "http-assert";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialDeploymentLeaseCreated } from "@src/billing/events/trial-deployment-lease-created";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { Trace, withSpan } from "@src/core/services/tracing/tracing.service";
import { UserRepository } from "@src/user/repositories";
import { BalancesService } from "../balances/balances.service";
import { BillingConfigService } from "../billing-config/billing-config.service";
import { ChainErrorService } from "../chain-error/chain-error.service";
import { TrialValidationService } from "../trial-validation/trial-validation.service";

type StringifiedEncodeObject = Omit<EncodeObject, "value"> & { value: string };

const SPENDING_TXS = [MsgCreateDeployment, MsgAccountDeposit];

@singleton()
export class ManagedSignerService {
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
    private readonly managedUserWalletService: ManagedUserWalletService
  ) {}

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
    const result = await this.executeDerivedDecodedTxByUserId(userId, decoded);

    const hasSpendingTx = decoded.some(message => SPENDING_TXS.some(msg => message.typeUrl.endsWith(msg.$type)));

    if (hasSpendingTx) {
      await this.walletReloadJobService.scheduleImmediate(userId);
    }

    return result;
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
    await this.#validateBalances(userWallet, messages);
    await this.anonymousValidateService.validateLeaseProvidersAuditors(messages, userWallet);

    const createLeaseMessage: { typeUrl: string; value: MsgCreateLease } | undefined = messages.find(message => message.typeUrl.endsWith(".MsgCreateLease"));
    const hasCreateTrialLeaseMessage = userWallet.isTrialing && !!createLeaseMessage;
    const hasLeases = hasCreateTrialLeaseMessage ? await this.leaseHttpService.hasLeases(userWallet.address!) : null;

    const tx = await this.executeDerivedTx(userWallet.id, messages);

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

    await this.balancesService.refreshUserWalletLimits(userWallet);

    const result = pick(tx, ["code", "hash", "transactionHash", "rawLog"]) as Pick<IndexedTx, "code" | "hash" | "rawLog">;

    if (result.hash) {
      return {
        ...result,
        transactionHash: result.hash
      };
    }

    return result as Pick<IndexedTx, "code" | "hash" | "rawLog"> & { transactionHash: string };
  }

  /**
   * Validates that the user wallet has sufficient balances to cover transaction fees and deployment costs.
   * Always fetches fee allowance from the chain to ensure accuracy, as database values may be out of sync.
   * Fetches deployment allowance from the chain only when a deployment message is present, otherwise uses cached value.
   * Automatically refills fee authorization for eligible trial wallets if fee allowance is below FEE_ALLOWANCE_REFILL_THRESHOLD.
   * Throws an assertion error if insufficient funds are available.
   *
   * @param userWallet - The user wallet to validate balances for
   * @param messages - Array of transaction messages to check for deployment messages
   * @throws {HttpError} 402 if there are not enough funds to cover the transaction fee
   * @throws {HttpError} 402 if there are not enough funds to cover deployment costs (when deployment message is present)
   */
  async #validateBalances(userWallet: UserWalletOutput, messages: EncodeObject[]) {
    return withSpan("ManagedSignerService.validateBalances", async () => {
      const hasDeploymentMessage = messages.some(message => message.typeUrl.endsWith(".MsgCreateDeployment"));
      const [existingFeeAllowance, deploymentAllowance] = await Promise.all([
        this.balancesService.retrieveAndCalcFeeLimit(userWallet),
        !hasDeploymentMessage ? Promise.resolve(userWallet.deploymentAllowance) : this.balancesService.retrieveDeploymentLimit(userWallet)
      ]);

      let feeAllowance = existingFeeAllowance;
      const needsRefill = feeAllowance < this.billingConfigService.get("FEE_ALLOWANCE_REFILL_THRESHOLD");

      const span = trace.getSpan(context.active());
      span?.setAttribute("balance.feeAllowance", feeAllowance);
      span?.setAttribute("balance.needsRefill", needsRefill);

      if (needsRefill) {
        await this.managedUserWalletService.refillWalletFees(this, userWallet);
        feeAllowance = await this.balancesService.retrieveAndCalcFeeLimit(userWallet);
      }

      assert(feeAllowance > 0, 402, "Not enough funds to cover the transaction fee");
      assert(!hasDeploymentMessage || deploymentAllowance > 0, 402, "Not enough funds to cover the deployment costs");
    });
  }

  private decodeMessages(messages: StringifiedEncodeObject[]): EncodeObject[] {
    return messages.map(message => {
      const value = new Uint8Array(Buffer.from(message.value, "base64"));
      const decoded = this.registry.decode({ value, typeUrl: message.typeUrl });

      return {
        typeUrl: message.typeUrl,
        value: decoded
      };
    });
  }
}
