import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet, EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { DeliverTxResponse } from "@cosmjs/stargate/build/stargateclient";
import assert from "http-assert";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { MasterWalletService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ChainErrorService } from "../chain-error/chain-error.service";
import { TrialValidationService } from "../trial-validation/trial-validation.service";

type StringifiedEncodeObject = Omit<EncodeObject, "value"> & { value: string };
type SimpleSigningStargateClient = {
  signAndBroadcast(messages: readonly EncodeObject[]): Promise<DeliverTxResponse>;
};

@singleton()
export class TxSignerService {
  private readonly HD_PATH = "m/44'/118'/0'/0";

  private readonly PREFIX = "akash";

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    @InjectTypeRegistry() private readonly registry: Registry,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly masterWalletService: MasterWalletService,
    private readonly balancesService: BalancesService,
    private readonly authService: AuthService,
    private readonly chainErrorService: ChainErrorService,
    private readonly anonymousValidateService: TrialValidationService
  ) {}

  async signAndBroadcast(userId: UserWalletOutput["userId"], messages: StringifiedEncodeObject[]) {
    const userWallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "sign").findByUserId(userId);
    assert(userWallet, 404, "UserWallet Not Found");

    const decodedMessages = this.decodeMessages(messages);

    try {
      await Promise.all(decodedMessages.map(message => this.anonymousValidateService.validateLeaseProviders(message, userWallet)));
    } catch (error) {
      throw this.chainErrorService.toAppError(error, decodedMessages);
    }

    const client = await this.getClientForAddressIndex(userWallet.id);
    const tx = await client.signAndBroadcast(decodedMessages);

    await this.balancesService.refreshUserWalletLimits(userWallet);

    return pick(tx, ["code", "transactionHash", "rawLog"]);
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

  private async getClientForAddressIndex(addressIndex: number): Promise<SimpleSigningStargateClient> {
    const wallet = await this.getWalletForAddressIndex(addressIndex);
    const client = await SigningStargateClient.connectWithSigner(this.config.RPC_NODE_ENDPOINT, wallet, {
      registry: this.registry
    });
    const walletAddress = (await wallet.getAccounts())[0].address;
    const granter = await this.masterWalletService.getFirstAddress();

    return {
      signAndBroadcast: async (messages: readonly EncodeObject[]) => {
        try {
          const gasEstimation = await client.simulate(walletAddress, messages, "managed wallet gas estimation");
          const estimatedGas = Math.round(gasEstimation * this.config.GAS_SAFETY_MULTIPLIER);
          const fee = calculateFee(estimatedGas, GasPrice.fromString("0.025uakt"));

          return await client.signAndBroadcast(walletAddress, messages, { ...fee, granter }, "managed wallet tx");
        } catch (error) {
          throw this.chainErrorService.toAppError(error, messages);
        }
      }
    };
  }

  private async getWalletForAddressIndex(addressIndex: number) {
    const hdPath = stringToPath(`${this.HD_PATH}/${addressIndex}`);
    return await DirectSecp256k1HdWallet.fromMnemonic(this.config.MASTER_WALLET_MNEMONIC, { prefix: this.PREFIX, hdPaths: [hdPath] });
  }
}
