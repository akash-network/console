import type { accountTxRole } from "@src/db/schema";
import type { DecodedBlock } from "@src/pipeline/decoded-block";

export type AccountTxRole = (typeof accountTxRole.enumValues)[number];

/** One address's participation in a transaction, before its address is interned to an account id. */
export interface DerivedAccountTx {
  address: string;
  height: number;
  txIndex: number;
  role: AccountTxRole;
}

/**
 * Builds the address activity log for a block: every transaction's signers plus the sender and recipient
 * of each of its `transfer` events. Rows are deduped per `(address, txIndex, role)` so they never collide
 * on the `account_txs` primary key. Block-level events have no owning transaction and are skipped.
 */
export function deriveAccountTxs(block: DecodedBlock): DerivedAccountTx[] {
  const rows: DerivedAccountTx[] = [];
  const seen = new Set<string>();

  const add = (address: string, txIndex: number, role: AccountTxRole) => {
    if (!address) {
      return;
    }
    const key = `${address}|${txIndex}|${role}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rows.push({ address, height: block.height, txIndex, role });
  };

  for (const tx of block.transactions) {
    for (const signer of tx.signerAddresses) {
      add(signer, tx.index, "signer");
    }

    for (const event of tx.events) {
      if (event.type === "transfer") {
        add(event.attributes.sender, tx.index, "sender");
        add(event.attributes.recipient, tx.index, "receiver");
      }
    }
  }

  return rows;
}
