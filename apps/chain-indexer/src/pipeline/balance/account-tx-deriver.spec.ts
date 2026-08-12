import { describe, expect, it } from "vitest";

import { deriveAccountTxs } from "@src/pipeline/balance/account-tx-deriver";
import type { DecodedBlock, DecodedEvent, DecodedTransaction } from "@src/pipeline/decoded-block";

describe("deriveAccountTxs", () => {
  it("records each signer of a transaction with the signer role", () => {
    const block = buildBlock([buildTx({ index: 0, signerAddresses: ["akash1signer1", "akash1signer2"] })]);

    expect(deriveAccountTxs(block)).toEqual([
      { address: "akash1signer1", height: 10, txIndex: 0, role: "signer" },
      { address: "akash1signer2", height: 10, txIndex: 0, role: "signer" }
    ]);
  });

  it("records the sender and recipient of a transfer event with their roles", () => {
    const block = buildBlock([buildTx({ index: 0, events: [event("transfer", { sender: "akash1a", recipient: "akash1b", amount: "1uakt" })] })]);

    expect(deriveAccountTxs(block)).toEqual([
      { address: "akash1a", height: 10, txIndex: 0, role: "sender" },
      { address: "akash1b", height: 10, txIndex: 0, role: "receiver" }
    ]);
  });

  it("dedups a repeated (address, tx, role) so the primary key never conflicts within a block", () => {
    const block = buildBlock([
      buildTx({
        index: 0,
        signerAddresses: ["akash1a", "akash1a"],
        events: [
          event("transfer", { sender: "akash1a", recipient: "akash1b", amount: "1uakt" }),
          event("transfer", { sender: "akash1a", recipient: "akash1b", amount: "2uakt" })
        ]
      })
    ]);

    expect(deriveAccountTxs(block)).toEqual([
      { address: "akash1a", height: 10, txIndex: 0, role: "signer" },
      { address: "akash1a", height: 10, txIndex: 0, role: "sender" },
      { address: "akash1b", height: 10, txIndex: 0, role: "receiver" }
    ]);
  });

  it("keeps the same address distinct across roles and transactions", () => {
    const block = buildBlock([
      buildTx({ index: 0, signerAddresses: ["akash1a"] }),
      buildTx({ index: 1, events: [event("transfer", { sender: "akash1a", recipient: "akash1b", amount: "1uakt" })] })
    ]);

    expect(deriveAccountTxs(block)).toEqual([
      { address: "akash1a", height: 10, txIndex: 0, role: "signer" },
      { address: "akash1a", height: 10, txIndex: 1, role: "sender" },
      { address: "akash1b", height: 10, txIndex: 1, role: "receiver" }
    ]);
  });

  it("ignores block-level transfer events, which have no transaction to attribute", () => {
    const block: DecodedBlock = { ...buildBlock([]), blockEvents: [event("transfer", { sender: "akash1a", recipient: "akash1b", amount: "1uakt" })] };

    expect(deriveAccountTxs(block)).toEqual([]);
  });

  function buildBlock(transactions: DecodedTransaction[]): DecodedBlock {
    return {
      height: 10,
      datetime: new Date("2026-08-11T00:00:00Z"),
      hash: Buffer.alloc(0),
      parentHash: null,
      proposerAddress: "PROPOSER",
      transactions,
      blockEvents: []
    };
  }

  function buildTx(input: { index: number; signerAddresses?: string[]; events?: DecodedEvent[] }): DecodedTransaction {
    return {
      index: input.index,
      hash: Buffer.alloc(0),
      code: 0,
      gasUsed: 0,
      gasWanted: 0,
      fee: [],
      messages: [],
      events: input.events ?? [],
      signerAddresses: input.signerAddresses ?? []
    };
  }

  function event(type: string, attributes: Record<string, string>): DecodedEvent {
    return { type, attributes };
  }
});
