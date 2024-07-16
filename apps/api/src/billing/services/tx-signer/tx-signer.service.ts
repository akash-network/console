import { getAkashTypeRegistry } from "@akashnetwork/akashjs/build/stargate";
import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet, EncodeObject, Registry } from "@cosmjs/proto-signing";
import { calculateFee, defaultRegistryTypes, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { DeliverTxResponse } from "@cosmjs/stargate/build/stargateclient";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserOutput, UserWalletRepository } from "@src/billing/repositories";
import { MasterSigningClientService, MasterWalletService } from "@src/billing/services";
import { ForbiddenException } from "@src/core";

const registry = new Registry([...defaultRegistryTypes, ...getAkashTypeRegistry()]);

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
    private readonly userWalletRepository: UserWalletRepository,
    private readonly masterWalletService: MasterWalletService,
    private readonly masterSigningClient: MasterSigningClientService
  ) {}

  async signAndBroadcast(userId: UserOutput["userId"], messages: StringifiedEncodeObject[]) {
    const userWallet = await this.userWalletRepository.findByUserId(userId);
    const decodedMessages = this.decodeMessages(messages);

    ForbiddenException.assert(userWallet);

    const client = await this.getClientForAddressIndex(userWallet.id);
    const tx = await client.signAndBroadcast(decodedMessages);

    return pick(tx, ["code", "transactionHash", "rawLog"]);
  }

  private decodeMessages(messages: StringifiedEncodeObject[]): EncodeObject[] {
    return messages.map(message => {
      const value = new Uint8Array(Buffer.from(message.value, "base64"));
      const decoded = registry.decode({ value, typeUrl: message.typeUrl });

      return {
        typeUrl: message.typeUrl,
        value: decoded
      };
    });
  }

  private async getClientForAddressIndex(addressIndex: number): Promise<SimpleSigningStargateClient> {
    const wallet = await this.getWalletForAddressIndex(addressIndex);
    const client = await SigningStargateClient.connectWithSigner(this.config.RPC_NODE_ENDPOINT, wallet, {
      registry
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
