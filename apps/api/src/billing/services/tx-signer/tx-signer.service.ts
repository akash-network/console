import { getAkashTypeRegistry } from "@akashnetwork/akashjs/build/stargate";
import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet, EncodeObject, Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient, StdFee } from "@cosmjs/stargate";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserOutput, UserWalletRepository } from "@src/billing/repositories";
import { ForbiddenException } from "@src/core";

@singleton()
export class TxSignerService {
  private readonly HD_PATH = "m/44'/118'/0'/0";

  private readonly PREFIX = "akash";

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  async sign(userId: UserOutput["userId"], messages: EncodeObject[], fee?: StdFee): Promise<string> {
    const userWallet = await this.userWalletRepository.findByUserId(userId);
    ForbiddenException.assert(userWallet);

    const client = await this.getClientForAddressIndex(userWallet.id);
    const signedTx = await client.sign(userWallet.address, messages, fee, "managed wallet signature");

    return TxRaw.encode(signedTx).finish().toString();
  }

  private async getClientForAddressIndex(addressIndex: number) {
    const wallet = await this.getWalletForAddressIndex(addressIndex);
    return await SigningStargateClient.connectWithSigner(this.config.RPC_NODE_ENDPOINT, wallet, {
      registry: new Registry(getAkashTypeRegistry())
    });
  }

  private async getWalletForAddressIndex(addressIndex: number) {
    const hdPath = stringToPath(`${this.HD_PATH}/${addressIndex}`);
    return await DirectSecp256k1HdWallet.fromMnemonic(this.config.MASTER_WALLET_MNEMONIC, { prefix: this.PREFIX, hdPaths: [hdPath] });
  }
}
