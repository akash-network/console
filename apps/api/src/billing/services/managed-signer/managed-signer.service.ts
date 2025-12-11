import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { LeaseHttpService } from "@akashnetwork/http-sdk";
import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { IndexedTx } from "@cosmjs/stargate";
import assert from "http-assert";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialDeploymentLeaseCreated } from "@src/billing/events/trial-deployment-lease-created";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { BalancesService } from "../balances/balances.service";
import { ChainErrorService } from "../chain-error/chain-error.service";
import { TrialValidationService } from "../trial-validation/trial-validation.service";

type StringifiedEncodeObject = Omit<EncodeObject, "value"> & { value: string };

const SPENDING_TXS = [MsgCreateDeployment, MsgAccountDeposit];

@singleton()
export class ManagedSignerService {
  constructor(
    @InjectTypeRegistry() private readonly registry: Registry,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository,
    private readonly balancesService: BalancesService,
    private readonly authService: AuthService,
    private readonly chainErrorService: ChainErrorService,
    private readonly anonymousValidateService: TrialValidationService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly txManagerService: TxManagerService,
    private readonly domainEvents: DomainEventsService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly walletReloadJobService: WalletReloadJobService
  ) {}

  async executeDerivedTx(walletIndex: number, messages: readonly EncodeObject[], useOldWallet: boolean = false) {
    try {
      const granter = await this.txManagerService.getFundingWalletAddress(useOldWallet);
      return await this.txManagerService.signAndBroadcastWithDerivedWallet(
        walletIndex,
        messages,
        {
          fee: { granter }
        },
        useOldWallet
      );
    } catch (error: any) {
      throw await this.chainErrorService.toAppError(error, messages);
    }
  }

  async executeFundingTx(messages: readonly EncodeObject[], useOldWallet: boolean = false) {
    try {
      return await this.txManagerService.signAndBroadcastWithFundingWallet(messages, useOldWallet);
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
    const user = this.authService.currentUser.userId === userId ? this.authService.currentUser : await this.userRepository.findById(userId);
    assert(user, 404, "User Not Found");

    return this.executeDecodedTxByUserWallet(userWallet, messages, user);
  }

  async executeDecodedTxByUserWallet(
    userWallet: UserWalletOutput,
    messages: EncodeObject[],
    walletOwner?: UserOutput
  ): Promise<{
    code: number;
    hash: string;
    transactionHash: string;
    rawLog: string;
  }> {
    assert(userWallet.feeAllowance > 0, 403, "Not enough funds to cover the transaction fee");

    const hasDeploymentMessage = messages.some(message => message.typeUrl.endsWith(".MsgCreateDeployment"));

    if (hasDeploymentMessage) {
      assert(userWallet.deploymentAllowance > 0, 403, "Not enough funds to cover the deployment costs");
    }

    await this.anonymousValidateService.validateLeaseProvidersAuditors(messages, userWallet);

    if (this.featureFlagsService.isEnabled(FeatureFlags.ANONYMOUS_FREE_TRIAL)) {
      const user = walletOwner?.id === userWallet.userId ? walletOwner : await this.userRepository.findById(userWallet.userId!);
      assert(user, 500, "User for wallet not found");
      await Promise.all(
        messages.map(message =>
          Promise.all([
            this.anonymousValidateService.validateLeaseProviders(message, userWallet, user),
            this.anonymousValidateService.validateTrialLimit(message, userWallet)
          ])
        )
      );
    }

    const createLeaseMessage: { typeUrl: string; value: MsgCreateLease } | undefined = messages.find(message => message.typeUrl.endsWith(".MsgCreateLease"));
    const hasCreateTrialLeaseMessage = userWallet.isTrialing && !!createLeaseMessage && !this.featureFlagsService.isEnabled(FeatureFlags.ANONYMOUS_FREE_TRIAL);
    const hasLeases = hasCreateTrialLeaseMessage ? await this.leaseHttpService.hasLeases(userWallet.address!) : null;

    const tx = await this.executeDerivedTx(userWallet.id, messages, userWallet.isOldWallet ?? false);

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
