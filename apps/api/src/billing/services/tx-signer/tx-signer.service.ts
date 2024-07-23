import { AllowanceHttpService } from "@akashnetwork/http-sdk";
import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet, EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { DeliverTxResponse } from "@cosmjs/stargate/build/stargateclient";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { MasterWalletService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ForbiddenException } from "@src/core";

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
    private readonly allowanceHttpService: AllowanceHttpService,
    private readonly balancesService: BalancesService
  ) {}

  async signAndBroadcast(userId: UserWalletOutput["userId"], messages: StringifiedEncodeObject[]) {
    const userWallet = await this.userWalletRepository.findByUserId(userId);
    const decodedMessages = this.decodeMessages(messages);

    ForbiddenException.assert(userWallet);

    const client = await this.getClientForAddressIndex(userWallet.id);
    const tx = await client.signAndBroadcast(decodedMessages);

    await this.balancesService.updateUserWalletLimits(userWallet);

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
    const { GAS_SAFETY_MULTIPLIER } = this.config;
    const granter = await this.masterWalletService.getFirstAddress();

    return {
      async signAndBroadcast(messages: readonly EncodeObject[]) {
        const gasEstimation = await client.simulate(walletAddress, messages, "managed wallet gas estimation");
        const estimatedGas = Math.round(gasEstimation * GAS_SAFETY_MULTIPLIER);
        const fee = calculateFee(estimatedGas, GasPrice.fromString(`0.025uakt`));

        return await client.signAndBroadcast(walletAddress, messages, { ...fee, granter }, "managed wallet tx");
      }
    };
  }

  private async getWalletForAddressIndex(addressIndex: number) {
    const hdPath = stringToPath(`${this.HD_PATH}/${addressIndex}`);
    return await DirectSecp256k1HdWallet.fromMnemonic(this.config.MASTER_WALLET_MNEMONIC, { prefix: this.PREFIX, hdPaths: [hdPath] });
  }
}
