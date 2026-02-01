import { AkashBlock as Block, AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { AddressReference, Transaction } from "@akashnetwork/database/dbSchemas/base";
import { QueryTypes, Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import type { Registry } from "@src/billing/providers/type-registry.provider";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { CHAIN_DB } from "@src/chain";
import { GetTransactionByHashResponse, ListTransactionsResponse } from "@src/transaction/http-schemas/transaction.schema";
import { msgToJSON } from "@src/utils/protobuf";

@singleton()
export class TransactionRepository {
  readonly #typeRegistry: Registry;
  readonly #chainDb: Sequelize;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize, @inject(TYPE_REGISTRY) typeRegistry: Registry) {
    this.#chainDb = chainDb;
    this.#typeRegistry = typeRegistry;
  }

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
        data: msgToJSON(this.#typeRegistry, msg.type, msg.data),
        relatedDeploymentId: msg.relatedDeploymentId
      }))
    };
  }

  async getTransactionsByAddress(address: string, skip?: number, limit?: number): Promise<GetAddressTransactionsResponse> {
    const countQuery = AddressReference.count({
      col: "transactionId",
      distinct: true,
      where: { address: address }
    });

    const txIdsQuery = this.#chainDb.query<{ id: string }>(
      `
      SELECT t.id
      FROM "addressReference" af
      INNER JOIN "transaction" t ON t.id = af."transactionId"
      WHERE af.address = ?
      GROUP BY t.id, af.height, t.index
      ORDER BY af.height DESC, t.index DESC
      OFFSET ? LIMIT ?
      `,
      {
        replacements: [address, skip, limit],
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
