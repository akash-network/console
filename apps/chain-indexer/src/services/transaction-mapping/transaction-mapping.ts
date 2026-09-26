import type { z } from "zod";

import type { FeeCoin } from "@src/db/schema";
import type { BlockTransaction, TransactionMessageSchema } from "@src/http-schemas/blocks.schema";

type TransactionMessage = z.infer<typeof TransactionMessageSchema>;

export interface MessageRow {
  txIndex: number;
  index: number;
  type: string;
}

export interface TransactionRow {
  index: number;
  hash: Buffer;
  code: number;
  gasUsed: number;
  gasWanted: number;
  fee: FeeCoin[];
}

/** Hashes are served as uppercase hex, the form the chain's own RPC and explorers use. */
export function toHex(bytes: Buffer): string {
  return bytes.toString("hex").toUpperCase();
}

export function groupMessagesByTransaction(rows: MessageRow[]): Map<number, TransactionMessage[]> {
  const byTransaction = new Map<number, TransactionMessage[]>();
  for (const row of rows) {
    const messages = byTransaction.get(row.txIndex) ?? [];
    messages.push({ index: row.index, type: row.type });
    byTransaction.set(row.txIndex, messages);
  }
  return byTransaction;
}

export function toBlockTransaction(row: TransactionRow, messages: TransactionMessage[]): BlockTransaction {
  return {
    index: row.index,
    hash: toHex(row.hash),
    code: row.code,
    gasUsed: row.gasUsed,
    gasWanted: row.gasWanted,
    fee: row.fee,
    messages
  };
}
