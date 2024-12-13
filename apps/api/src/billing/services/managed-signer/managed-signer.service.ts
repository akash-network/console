import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import assert from "http-assert";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { BatchSigningClientService } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { InjectSigningClient } from "@src/billing/providers/signing-client.provider";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { DedupeSigningClientService } from "@src/billing/services/dedupe-signing-client/dedupe-signing-client.service";
import { ChainErrorService } from "../chain-error/chain-error.service";
import { TrialValidationService } from "../trial-validation/trial-validation.service";

type StringifiedEncodeObject = Omit<EncodeObject, "value"> & { value: string };

@singleton()
export class ManagedSignerService {
  private readonly wallet = new Wallet(this.config.get("MASTER_WALLET_MNEMONIC"));

  constructor(
    private readonly config: BillingConfigService,
    @InjectTypeRegistry() private readonly registry: Registry,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly balancesService: BalancesService,
    private readonly authService: AuthService,
    private readonly chainErrorService: ChainErrorService,
    private readonly anonymousValidateService: TrialValidationService,
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
    const userWallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "sign").findOneByUserId(userId);
    assert(userWallet, 404, "UserWallet Not Found");

    const decodedMessages = this.decodeMessages(messages);

    try {
      await Promise.all(decodedMessages.map(message => this.anonymousValidateService.validateLeaseProviders(message, userWallet)));
    } catch (error) {
      throw this.chainErrorService.toAppError(error, decodedMessages);
    }

    const tx = await this.executeManagedTx(userWallet.id, decodedMessages);

    await this.balancesService.refreshUserWalletLimits(userWallet);

    const result = pick(tx, ["code", "hash", "transactionHash", "rawLog"]);

    if (result.hash) {
      return {
        ...result,
        transactionHash: result.hash
      };
    }

    return result;
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
