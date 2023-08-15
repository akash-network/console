import { AddressReference, Message, Transaction } from "@shared/dbSchemas/base";
import { MsgSend, MsgMultiSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgFundCommunityPool } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgDeposit } from "cosmjs-types/cosmos/gov/v1beta1/tx";
import { MsgBeginRedelegate, MsgDelegate, MsgUndelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import * as benchmark from "../shared/utils/benchmark";
import { Indexer } from "./indexer";
import { toBech32 } from "@cosmjs/encoding";
import { DecodedTxRaw, decodePubkey } from "@cosmjs/proto-signing";
import { rawSecp256k1PubkeyToRawAddress } from "@src/shared/utils/addresses";
import { getAmountFromCoin, getAmountFromCoinArray } from "@src/shared/utils/coin";
import { activeChain } from "@shared/chainDefinitions";

export class MessageAddressesIndexer extends Indexer {
  constructor() {
    super();
    this.name = "MessageAddressesIndexer";
    this.processFailedTxs = true;
    this.msgHandlers = {
      "/cosmos.bank.v1beta1.MsgSend": this.handleMsgSend,
      "/cosmos.distribution.v1beta1.MsgFundCommunityPool": this.handleMsgFundCommunityPool,
      "/cosmos.gov.v1beta1.MsgDeposit": this.handleMsgDeposit,
      "/cosmos.staking.v1beta1.MsgBeginRedelegate": this.handleMsgBeginRedelegate,
      "/cosmos.staking.v1beta1.MsgDelegate": this.handleMsgDelegate,
      "/cosmos.staking.v1beta1.MsgUndelegate": this.handleMsgUndelegate,
      "/cosmos.bank.v1beta1.MsgMultiSend": this.handleMsgMultiSend
    };
  }

  @benchmark.measureMethodAsync
  async dropTables(): Promise<void> {
    await AddressReference.drop();
  }

  async createTables(): Promise<void> {
    await AddressReference.sync({ force: false });
  }

  private async handleMsgSend(decodedMessage: MsgSend, height: number, dbTransaction, msg: Message) {
    await AddressReference.bulkCreate(
      [
        {
          messageId: msg.id,
          transactionId: msg.txId,
          address: decodedMessage.fromAddress,
          type: "Sender"
        },
        {
          messageId: msg.id,
          transactionId: msg.txId,
          address: decodedMessage.toAddress,
          type: "Receiver"
        }
      ],
      { transaction: dbTransaction }
    );

    msg.amount = getAmountFromCoinArray(decodedMessage.amount, "uakt");
  }

  private async handleMsgMultiSend(decodedMessage: MsgMultiSend, height: number, dbTransaction, msg: Message) {
    const senders = decodedMessage.inputs.map((input) => ({
      messageId: msg.id,
      transactionId: msg.txId,
      address: input.address,
      type: "Sender"
    }));
    const receivers = decodedMessage.outputs.map((output) => ({
      messageId: msg.id,
      transactionId: msg.txId,
      address: output.address,
      type: "Receiver"
    }));

    await AddressReference.bulkCreate([...senders, ...receivers], { transaction: dbTransaction });
  }

  private async handleMsgFundCommunityPool(decodedMessage: MsgFundCommunityPool, height: number, dbTransaction, msg: Message) {
    msg.amount = getAmountFromCoinArray(decodedMessage.amount, "uakt");
  }

  private async handleMsgDeposit(decodedMessage: MsgDeposit, height: number, dbTransaction, msg: Message) {
    msg.amount = getAmountFromCoinArray(decodedMessage.amount, "uakt");
  }

  private async handleMsgBeginRedelegate(decodedMessage: MsgBeginRedelegate, height: number, dbTransaction, msg: Message) {
    msg.amount = getAmountFromCoin(decodedMessage.amount, "uakt");
  }

  private async handleMsgDelegate(decodedMessage: MsgDelegate, height: number, dbTransaction, msg: Message) {
    msg.amount = getAmountFromCoin(decodedMessage.amount, "uakt");
  }

  private async handleMsgUndelegate(decodedMessage: MsgUndelegate, height: number, dbTransaction, msg: Message) {
    msg.amount = getAmountFromCoin(decodedMessage.amount, "uakt");
  }

  public async afterEveryTransaction(rawTx: DecodedTxRaw, currentTransaction: Transaction, dbTransaction): Promise<void> {
    const { multisigThreshold, addresses } = this.getTransactionSignerAddresses(rawTx, currentTransaction.hash);

    currentTransaction.multisigThreshold = multisigThreshold;

    await AddressReference.bulkCreate(
      addresses.map((address) => ({
        messageId: null,
        transactionId: currentTransaction.id,
        address: address,
        type: "Signer"
      })),
      { transaction: dbTransaction }
    );
  }

  private getTransactionSignerAddresses(tx: DecodedTxRaw, hash: string) {
    const signerInfos = tx.authInfo.signerInfos;

    if (signerInfos.length !== 1) {
      console.warn("More than one signer in tx: " + hash);
    }

    let multisigThreshold: number | null = null;
    let addresses: string[] = [];

    for (const signerInfo of signerInfos) {
      if (!signerInfo.publicKey) continue;

      const pubkey = decodePubkey(signerInfo.publicKey);
      if (pubkey.type === "tendermint/PubKeySecp256k1") {
        const pubKeyBuffer = Buffer.from(pubkey.value, "base64");

        addresses.push(toBech32(activeChain.bech32Prefix, rawSecp256k1PubkeyToRawAddress(pubKeyBuffer)));
      } else if (pubkey.type === "tendermint/PubKeyMultisigThreshold") {
        multisigThreshold = pubkey.value.threshold;
        addresses = addresses.concat(
          pubkey.value.pubkeys.map((p) => {
            const pubKeyBuffer = Buffer.from(p.value, "base64");
            return toBech32(activeChain.bech32Prefix, rawSecp256k1PubkeyToRawAddress(pubKeyBuffer));
          })
        );
      } else {
        throw "Unrecognized pubkey type: " + JSON.stringify(pubkey);
      }
    }

    return { multisigThreshold, addresses };
  }
}
