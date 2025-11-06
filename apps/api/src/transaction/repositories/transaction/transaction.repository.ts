import { AkashBlock as Block, AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { AddressReference, Transaction } from "@akashnetwork/database/dbSchemas/base";
import { QueryTypes } from "sequelize";
import { singleton } from "tsyringe";

import { GetAddressTransactionsParams, GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import { chainDb } from "@src/db/dbConnection";
import { GetTransactionByHashResponse, ListTransactionsResponse } from "@src/transaction/http-schemas/transaction.schema";
import { msgToJSON } from "@src/utils/protobuf";

@singleton()
export class TransactionRepository {
  async getTransactions(limit: number): Promise<ListTransactionsResponse> {
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

    return transactions.map(tx => ({
      height: tx.block.height,
      datetime: tx.block.datetime.toISOString(),
      hash: tx.hash,
      isSuccess: !tx.hasProcessingError,
      error: tx.hasProcessingError && tx.log ? tx.log : null,
      gasUsed: tx.gasUsed,
      gasWanted: tx.gasWanted,
      fee: parseInt(tx.fee),
      memo: tx.memo,
      messages: (tx.messages || []).map(msg => ({
        id: msg.id,
        type: msg.type,
        amount: parseInt(msg.amount || "0")
      }))
    }));
  }

  async getTransactionByHash(hash: string): Promise<GetTransactionByHashResponse | null> {
    const tx = await Transaction.findOne({
      where: {
        hash
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
      datetime: tx.block.datetime.toISOString(),
      hash: tx.hash,
      isSuccess: !tx.hasProcessingError,
      multisigThreshold: tx.multisigThreshold,
      signers: (tx.addressReferences || []).filter(x => x.type === "Signer").map(x => x.address),
      error: tx.hasProcessingError ? tx.log || null : null,
      gasUsed: tx.gasUsed,
      gasWanted: tx.gasWanted,
      fee: parseInt(tx.fee),
      memo: tx.memo,
      messages: messages.map(msg => ({
        id: msg.id,
        type: msg.type,
        data: msgToJSON(msg.type, msg.data),
        relatedDeploymentId: msg.relatedDeploymentId
      }))
    };
  }

  async getTransactionsByAddress({ address, ...query }: GetAddressTransactionsParams): Promise<GetAddressTransactionsResponse> {
    const countQuery = AddressReference.count({
      col: "transactionId",
      distinct: true,
      where: { address: address }
    });

    const txIdsQuery = chainDb.query<{ id: string }>(
      `
      SELECT t.id
      FROM "transaction" t
      WHERE EXISTS (
        SELECT 1
        FROM "addressReference" af
        WHERE af.address = ?
          AND af."transactionId" = t.id
      )
      ORDER BY t.height DESC, t.index DESC
      OFFSET ? LIMIT ?
      `,
      {
        replacements: [address, query.skip, query.limit],
        type: QueryTypes.SELECT
      }
    );

    const [count, txIds] = await Promise.all([countQuery, txIdsQuery]);

    const txs = await Transaction.findAll({
      include: [{ model: Block, required: true }, { model: Message }, { model: AddressReference, required: true, where: { address: address } }],
      where: { id: txIds.map(x => x.id) },
      order: [
        ["height", "DESC"],
        ["index", "DESC"]
      ]
    });

    return {
      count: count,
      results: txs.map(tx => ({
        height: tx.height,
        datetime: tx.block.datetime.toISOString(),
        hash: tx.hash,
        isSuccess: !tx.hasProcessingError,
        error: tx.hasProcessingError && tx.log ? tx.log : null,
        gasUsed: tx.gasUsed,
        gasWanted: tx.gasWanted,
        fee: parseInt(tx.fee),
        memo: tx.memo,
        isSigner: (tx.addressReferences || []).some(ar => ar.type === "Signer"),
        messages: (tx.messages || []).map(msg => ({
          id: msg.id,
          type: msg.type,
          amount: parseInt(msg.amount || "0"),
          isReceiver: (tx.addressReferences || []).some(ar => ar.messageId === msg.id && ar.type === "Receiver")
        }))
      }))
    };
  }
}
