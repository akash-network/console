import { AkashBlock as Block, AkashMessage as Message } from "@akashnetwork/database/dbSchemas/akash";
import { AddressReference, Transaction } from "@akashnetwork/database/dbSchemas/base";
import { QueryTypes } from "sequelize";

import { chainDb } from "@src/db/dbConnection";

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
    where: { id: txIds.map(x => x.transactionId) },
    order: [
      ["height", "DESC"],
      ["index", "DESC"]
    ]
  });

  return {
    count: count,
    results: txs.map(tx => ({
      height: tx.height,
      datetime: tx.block.datetime,
      hash: tx.hash,
      isSuccess: !tx.hasProcessingError,
      error: tx.hasProcessingError ? tx.log : null,
      gasUsed: tx.gasUsed,
      gasWanted: tx.gasWanted,
      fee: parseInt(tx.fee),
      memo: tx.memo,
      isSigner: (tx.addressReferences || []).some(ar => ar.type === "Signer"),
      messages: (tx.messages || []).map(msg => ({
        id: msg.id,
        type: msg.type,
        amount: msg.amount,
        isReceiver: (tx.addressReferences || []).some(ar => ar.messageId === msg.id && ar.type === "Receiver")
      }))
    }))
  };
}
