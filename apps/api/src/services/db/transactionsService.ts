import { Transaction, AddressReference } from "@akashnetwork/cloudmos-shared/dbSchemas/base";
import { AkashBlock as Block, AkashMessage as Message } from "@akashnetwork/cloudmos-shared/dbSchemas/akash";
import { msgToJSON } from "@src/utils/protobuf";
import { QueryTypes } from "sequelize";
import { chainDb } from "@src/db/dbConnection";
import { ApiTransactionResponse } from "@src/types/transactions";

export async function getTransactions(limit: number) {
  const _limit = Math.min(limit, 100);
  const transactions = await Transaction.findAll({
    order: [
      ["height", "DESC"],
      ["index", "ASC"]
    ],
    limit: _limit,
    include: [
      {
        model: Block,
        required: true
      },
      {
        model: Message
      }
    ]
  });

  return transactions.map((tx) => ({
    height: tx.block.height,
    datetime: tx.block.datetime,
    hash: tx.hash,
    isSuccess: !tx.hasProcessingError,
    error: tx.hasProcessingError ? tx.log : null,
    gasUsed: tx.gasUsed,
    gasWanted: tx.gasWanted,
    fee: tx.fee,
    memo: tx.memo,
    messages: tx.messages.map((msg) => ({
      id: msg.id,
      type: msg.type,
      amount: msg.amount
    }))
  }));
}

export async function getTransaction(hash: string): Promise<ApiTransactionResponse | null> {
  const tx = await Transaction.findOne({
    where: {
      hash: hash
    },
    include: [
      {
        model: Block,
        required: true
      },
      {
        model: AddressReference,
        required: false,
        attributes: ["address", "type"],
        where: {
          type: "Signer"
        }
      }
    ]
  });

  if (!tx) {
    return null;
  }

  const messages = await Message.findAll({
    where: {
      txId: tx.id
    }
  });

  return {
    height: tx.block.height,
    datetime: tx.block.datetime,
    hash: tx.hash,
    isSuccess: !tx.hasProcessingError,
    multisigThreshold: tx.multisigThreshold,
    signers: tx.addressReferences.filter((x) => x.type === "Signer").map((x) => x.address),
    error: tx.hasProcessingError ? tx.log : null,
    gasUsed: tx.gasUsed,
    gasWanted: tx.gasWanted,
    fee: tx.fee,
    memo: tx.memo,
    messages: messages.map((msg) => ({
      id: msg.id,
      type: msg.type,
      data: msgToJSON(msg.type, msg.data),
      relatedDeploymentId: (msg as Message).relatedDeploymentId
    }))
  };
}

export async function getTransactionByAddress(address: string, skip: number, limit: number) {
  const countQuery = AddressReference.count({
    col: "transactionId",
    distinct: true,
    where: { address: address }
  });

  const txIdsQuery = chainDb.query<{ transactionId: string }>(
    `SELECT "transactionId" FROM (
          SELECT DISTINCT ON(af."transactionId") *
          FROM "addressReference" af
          INNER JOIN transaction t ON t.id=af."transactionId"
          WHERE af.address=?
      ) sub
      ORDER BY height DESC, index DESC
      OFFSET ? LIMIT ?`,
    {
      replacements: [address, skip, limit],
      type: QueryTypes.SELECT
    }
  );

  const [count, txIds] = await Promise.all([countQuery, txIdsQuery]);

  const txs = await Transaction.findAll({
    include: [{ model: Block, required: true }, { model: Message }, { model: AddressReference, required: true, where: { address: address } }],
    where: { id: txIds.map((x) => x.transactionId) },
    order: [
      ["height", "DESC"],
      ["index", "DESC"]
    ]
  });

  return {
    count: count,
    results: txs.map((tx) => ({
      height: tx.height,
      datetime: tx.block.datetime,
      hash: tx.hash,
      isSuccess: !tx.hasProcessingError,
      error: tx.hasProcessingError ? tx.log : null,
      gasUsed: tx.gasUsed,
      gasWanted: tx.gasWanted,
      fee: tx.fee,
      memo: tx.memo,
      isSigner: tx.addressReferences.some((ar) => ar.type === "Signer"),
      messages: tx.messages.map((msg) => ({
        id: msg.id,
        type: msg.type,
        amount: msg.amount,
        isReceiver: tx.addressReferences.some((ar) => ar.messageId === msg.id && ar.type === "Receiver")
      }))
    }))
  };
}
