import type { SQL } from "drizzle-orm";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { inject, singleton } from "tsyringe";
import type { z } from "zod";

import { Accounts, AccountTxs, Blocks, Messages, MessageTypes, Transactions } from "@src/db/schema";
import type { AccountTxRoleSchema, AddressTransaction, ListAddressTransactionsResponse } from "@src/http-schemas/address-transactions.schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { groupMessagesByTransaction, toBlockTransaction } from "@src/services/transaction-mapping/transaction-mapping";

type AccountTxRole = z.infer<typeof AccountTxRoleSchema>;

interface Page {
  skip: number;
  limit: number;
}

/**
 * Address history off the activity log: `account_txs` is keyed `(account_id, height, tx_index, role)`, so
 * one backward scan of that key both orders a page newest-first and folds the roles of each transaction,
 * and the total is a count over the same key prefix. Transactions and messages are then fetched by their
 * own primary keys for just the page.
 */
@singleton()
export class AddressTransactionsService {
  readonly #db: ChainDatabase;

  constructor(@inject(CHAIN_DB) db: ChainDatabase) {
    this.#db = db;
  }

  async list(address: string, page: Page): Promise<ListAddressTransactionsResponse["data"]> {
    const [account] = await this.#db.select({ id: Accounts.id }).from(Accounts).where(eq(Accounts.address, address));
    if (!account) {
      return { total: 0, transactions: [] };
    }

    const [[{ total }], hits] = await Promise.all([
      this.#db
        .select({ total: sql<number>`count(distinct (${AccountTxs.height}, ${AccountTxs.txIndex}))::int` })
        .from(AccountTxs)
        .where(eq(AccountTxs.accountId, account.id)),
      this.#db
        .select({
          height: AccountTxs.height,
          txIndex: AccountTxs.txIndex,
          roles: sql<string[]>`array_agg(distinct ${AccountTxs.role}::text order by ${AccountTxs.role}::text)`
        })
        .from(AccountTxs)
        .where(eq(AccountTxs.accountId, account.id))
        .groupBy(AccountTxs.height, AccountTxs.txIndex)
        .orderBy(desc(AccountTxs.height), desc(AccountTxs.txIndex))
        .limit(page.limit)
        .offset(page.skip)
    ]);

    if (hits.length === 0) {
      return { total, transactions: [] };
    }

    const pairs = sql.join(
      hits.map(hit => sql`(${hit.height}, ${hit.txIndex})`),
      sql`, `
    );
    const [transactions, messages] = await Promise.all([
      this.#db
        .select({ transaction: Transactions, datetime: Blocks.datetime })
        .from(Transactions)
        .innerJoin(Blocks, eq(Blocks.height, Transactions.height))
        .where(inPairs(Transactions.height, Transactions.index, pairs)),
      this.#db
        .select({ height: Messages.height, txIndex: Messages.txIndex, index: Messages.index, type: MessageTypes.type })
        .from(Messages)
        .innerJoin(MessageTypes, eq(Messages.typeId, MessageTypes.id))
        .where(inPairs(Messages.height, Messages.txIndex, pairs))
        .orderBy(asc(Messages.index))
    ]);

    const transactionByKey = new Map(transactions.map(row => [pairKey(row.transaction.height, row.transaction.index), row]));
    const messagesByHeight = new Map<number, ReturnType<typeof groupMessagesByTransaction>>();
    for (const height of new Set(messages.map(message => message.height))) {
      messagesByHeight.set(height, groupMessagesByTransaction(messages.filter(message => message.height === height)));
    }

    return {
      total,
      transactions: hits.map(hit => {
        const row = transactionByKey.get(pairKey(hit.height, hit.txIndex));
        if (!row) {
          throw new Error(`Activity log references transaction ${hit.height}:${hit.txIndex} that is not stored`);
        }
        return toAddressTransaction(row.transaction, row.datetime, hit.roles as AccountTxRole[], messagesByHeight.get(hit.height)?.get(hit.txIndex) ?? []);
      })
    };
  }
}

function inPairs(heightColumn: PgColumn, indexColumn: PgColumn, pairs: SQL): SQL {
  return sql`(${heightColumn}, ${indexColumn}) IN (${pairs})`;
}

function pairKey(height: number, txIndex: number): string {
  return `${height}:${txIndex}`;
}

function toAddressTransaction(
  transaction: typeof Transactions.$inferSelect,
  datetime: Date,
  roles: AccountTxRole[],
  messages: AddressTransaction["messages"]
): AddressTransaction {
  const { index: _index, ...blockTransaction } = toBlockTransaction(transaction, messages);
  return { height: transaction.height, datetime: datetime.toISOString(), roles, ...blockTransaction };
}
