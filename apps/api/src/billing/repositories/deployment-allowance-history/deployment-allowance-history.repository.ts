import { QueryTypes, type Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { CHAIN_DB } from "@src/chain/providers/sequelize.provider";

export type ChainTxPosition = { height: number; txIndex: number };

export type IndexedTx = ChainTxPosition & { isSucceeded: boolean };

/** A message that changed a grant: the granter's own grant or revoke, or a message of the grantee's that drew on it or had its escrow return unspent coins to it, with the granter's coins it moved. */
export type AllowanceChange = ChainTxPosition & { msgIndex: number; type: string; data: Uint8Array; spentByGranter: string[]; receivedByGranter: string[] };

/** Authz emits one of these whenever it saves or deletes a grant, so every change to a grant, whoever made it, carries one. */
const GRANT_EVENT_TYPES = ["cosmos.authz.v1beta1.EventGrant", "cosmos.authz.v1beta1.EventRevoke"];

/** Reads how a grant changed from what the chain index stored, which it writes together with the block that holds it. */
@singleton()
export class DeploymentAllowanceHistoryRepository {
  readonly #chainDb: Sequelize;

  constructor(@inject(CHAIN_DB) chainDb: Sequelize) {
    this.#chainDb = chainDb;
  }

  async findTx(hash: string): Promise<IndexedTx | undefined> {
    const [row] = await this.#chainDb.query<{ height: number; txIndex: number; hasProcessingError: boolean }>(
      `/* deployment-allowance:tx */ SELECT height, index AS "txIndex", "hasProcessingError" FROM transaction WHERE hash = :hash LIMIT 1`,
      { type: QueryTypes.SELECT, replacements: { hash } }
    );

    return row && { height: row.height, txIndex: row.txIndex, isSucceeded: !row.hasProcessingError };
  }

  /** Oldest first, from the block after `afterHeight` up to the transaction at `before`; typed event values are stored JSON-encoded, and the fenced laterals keep the event tables read by transaction. */
  async findChanges({
    granter,
    grantee,
    msgTypeUrl,
    afterHeight,
    before
  }: {
    granter: string;
    grantee: string;
    msgTypeUrl: string;
    afterHeight: number;
    before: ChainTxPosition;
  }): Promise<AllowanceChange[]> {
    return await this.#chainDb.query<AllowanceChange>(
      `/* deployment-allowance:changes */
      SELECT DISTINCT ON (t.height, t.index, m.index)
        t.height,
        t.index AS "txIndex",
        m.index AS "msgIndex",
        m.type,
        m.data,
        COALESCE(granter_coins.spent, ARRAY[]::text[]) AS "spentByGranter",
        COALESCE(granter_coins.received, ARRAY[]::text[]) AS "receivedByGranter"
      FROM transaction t
      CROSS JOIN LATERAL (
        SELECT event_msg_index.value AS msg_index
        FROM transaction_event e
        INNER JOIN transaction_event_attribute event_granter
          ON event_granter.transaction_event_id = e.id AND event_granter.key = 'granter' AND event_granter.value = :encodedGranter
        INNER JOIN transaction_event_attribute event_grantee
          ON event_grantee.transaction_event_id = e.id AND event_grantee.key = 'grantee' AND event_grantee.value = :encodedGrantee
        INNER JOIN transaction_event_attribute event_msg_type
          ON event_msg_type.transaction_event_id = e.id AND event_msg_type.key = 'msg_type_url' AND event_msg_type.value = :encodedMsgTypeUrl
        INNER JOIN transaction_event_attribute event_msg_index
          ON event_msg_index.transaction_event_id = e.id AND event_msg_index.key = 'msg_index'
        WHERE e.tx_id = t.id AND e.type IN (:grantEventTypes)
        OFFSET 0
      ) grant_event
      INNER JOIN message m ON m."txId" = t.id AND m.index::text = grant_event.msg_index
      LEFT JOIN LATERAL (
        SELECT
          array_agg(amount.value ORDER BY coin_event.index) FILTER (WHERE coin_event.type = 'coin_spent') AS spent,
          array_agg(amount.value ORDER BY coin_event.index) FILTER (WHERE coin_event.type = 'coin_received') AS received
        FROM transaction_event coin_event
        INNER JOIN transaction_event_attribute coin_owner
          ON coin_owner.transaction_event_id = coin_event.id AND coin_owner.key IN ('spender', 'receiver') AND coin_owner.value = :granter
        INNER JOIN transaction_event_attribute coin_msg_index
          ON coin_msg_index.transaction_event_id = coin_event.id AND coin_msg_index.key = 'msg_index' AND coin_msg_index.value = grant_event.msg_index
        INNER JOIN transaction_event_attribute amount ON amount.transaction_event_id = coin_event.id AND amount.key = 'amount'
        WHERE coin_event.tx_id = t.id AND coin_event.type IN ('coin_spent', 'coin_received')
        OFFSET 0
      ) granter_coins ON TRUE
      WHERE t.height > :afterHeight
        AND t.height <= :beforeHeight
        AND (t.height, t.index) < (:beforeHeight, :beforeTxIndex)
        AND NOT t."hasProcessingError"
      ORDER BY t.height, t.index, m.index`,
      {
        type: QueryTypes.SELECT,
        replacements: {
          grantEventTypes: GRANT_EVENT_TYPES,
          granter,
          encodedGranter: JSON.stringify(granter),
          encodedGrantee: JSON.stringify(grantee),
          encodedMsgTypeUrl: JSON.stringify(msgTypeUrl),
          afterHeight,
          beforeHeight: before.height,
          beforeTxIndex: before.txIndex
        }
      }
    );
  }
}
