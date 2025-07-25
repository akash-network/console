import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { IndexedTx } from "@cosmjs/stargate";
import assert from "http-assert";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { BatchSigningClientService } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { InjectSigningClient } from "@src/billing/providers/signing-client.provider";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { UserRepository } from "@src/user/repositories";
import { BalancesService } from "../balances/balances.service";
import { BillingConfigService } from "../billing-config/billing-config.service";
import { ChainErrorService } from "../chain-error/chain-error.service";
import { DedupeSigningClientService } from "../dedupe-signing-client/dedupe-signing-client.service";
import { TrialValidationService } from "../trial-validation/trial-validation.service";

type StringifiedEncodeObject = Omit<EncodeObject, "value"> & { value: string };

@singleton()
export class ManagedSignerService {
  private readonly wallet = new Wallet(this.config.get("MASTER_WALLET_MNEMONIC"));

  constructor(
    private readonly config: BillingConfigService,
    @InjectTypeRegistry() private readonly registry: Registry,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository,
    private readonly balancesService: BalancesService,
    private readonly authService: AuthService,
    private readonly chainErrorService: ChainErrorService,
    private readonly anonymousValidateService: TrialValidationService,
    private readonly featureFlagsService: FeatureFlagsService,
    @InjectSigningClient("MANAGED") private readonly masterSigningClientService: BatchSigningClientService,
    private readonly dedupeSigningClientService: DedupeSigningClientService
  ) {}

  async executeManagedTx(walletIndex: number, messages: readonly EncodeObject[]) {
    const granter = await this.wallet.getFirstAddress();
    return await this.dedupeSigningClientService.executeManagedTx(this.config.get("MASTER_WALLET_MNEMONIC"), walletIndex, messages, {
      fee: { granter }
    });
  }

  async executeRootTx(messages: readonly EncodeObject[]) {
    return await this.masterSigningClientService.executeTx(messages);
  }

  async executeEncodedTxByUserId(userId: UserWalletOutput["userId"], messages: StringifiedEncodeObject[]) {
    return this.executeDecodedTxByUserId(userId, this.decodeMessages(messages));
  }

  async executeDecodedTxByUserId(
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

    if (this.featureFlagsService.isEnabled(FeatureFlags.ANONYMOUS_FREE_TRIAL)) {
      await Promise.all(
        messages.map(message =>
          Promise.all([
            this.anonymousValidateService.validateLeaseProviders(message, userWallet, user),
            this.anonymousValidateService.validateTrialLimit(message, userWallet)
          ])
        )
      );
    }

    try {
      const tx = await this.executeManagedTx(userWallet.id, messages);

      await this.balancesService.refreshUserWalletLimits(userWallet);

      const result = pick(tx, ["code", "hash", "transactionHash", "rawLog"]) as Pick<IndexedTx, "code" | "hash" | "rawLog">;

      if (result.hash) {
        return {
          ...result,
          transactionHash: result.hash
        };
      }

      return result as Pick<IndexedTx, "code" | "hash" | "rawLog"> & { transactionHash: string };
    } catch (error: any) {
      throw await this.chainErrorService.toAppError(error, messages);
    }
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
