import { describe, expect, it } from "vitest";

import { AKASH_ADDRESS_PREFIX } from "@src/genesis/genesis-address";
import { deriveBalanceChanges } from "@src/pipeline/balance/balance-deriver";
import { buildModuleAddressRegistry, deriveModuleAddress } from "@src/pipeline/balance/module-address-registry";
import type { DecodedBlock, DecodedEvent, DecodedTransaction } from "@src/pipeline/decoded-block";

const registry = buildModuleAddressRegistry(AKASH_ADDRESS_PREFIX);
const feeCollector = deriveModuleAddress("fee_collector", AKASH_ADDRESS_PREFIX);

describe("deriveBalanceChanges", () => {
  it("emits a debit and a credit for a simple transfer with correlated counterparties", () => {
    const block = buildBlock({
      transactions: [
        buildTx({
          index: 0,
          events: [
            event("coin_spent", { spender: "akash1a", amount: "100uakt", msg_index: "0" }, 0),
            event("coin_received", { receiver: "akash1b", amount: "100uakt", msg_index: "0" }, 0),
            event("transfer", { sender: "akash1a", recipient: "akash1b", amount: "100uakt", msg_index: "0" }, 0)
          ]
        })
      ]
    });

    expect(deriveBalanceChanges(block, registry)).toEqual([
      { address: "akash1a", counterpartyAddress: "akash1b", denom: "uakt", delta: -100n, reason: "transfer", height: 10, txIndex: 0, eventIndex: 0 },
      { address: "akash1b", counterpartyAddress: "akash1a", denom: "uakt", delta: 100n, reason: "transfer", height: 10, txIndex: 0, eventIndex: 1 }
    ]);
  });

  it("assigns a deterministic block-wide event index across txs then block events, expanding per denom in amount order", () => {
    const block = buildBlock({
      transactions: [
        buildTx({ index: 0, events: [event("coin_spent", { spender: "akash1a", amount: "5uakt,3uatom" }, undefined)] }),
        buildTx({ index: 1, events: [event("coin_received", { receiver: "akash1b", amount: "7uakt" }, undefined)] })
      ],
      blockEvents: [event("coin_received", { receiver: "akash1c", amount: "9uakt" }, undefined)]
    });

    expect(
      deriveBalanceChanges(block, registry).map(change => ({
        eventIndex: change.eventIndex,
        address: change.address,
        denom: change.denom,
        delta: change.delta,
        txIndex: change.txIndex
      }))
    ).toEqual([
      { eventIndex: 0, address: "akash1a", denom: "uakt", delta: -5n, txIndex: 0 },
      { eventIndex: 1, address: "akash1a", denom: "uatom", delta: -3n, txIndex: 0 },
      { eventIndex: 2, address: "akash1b", denom: "uakt", delta: 7n, txIndex: 1 },
      { eventIndex: 3, address: "akash1c", denom: "uakt", delta: 9n, txIndex: null }
    ]);
  });

  it("classifies a fee payment to the fee collector", () => {
    const block = buildBlock({
      transactions: [
        buildTx({
          index: 0,
          events: [
            event("coin_spent", { spender: "akash1payer", amount: "500uakt" }, undefined),
            event("coin_received", { receiver: feeCollector, amount: "500uakt" }, undefined),
            event("transfer", { sender: "akash1payer", recipient: feeCollector, amount: "500uakt" }, undefined)
          ]
        })
      ]
    });

    const changes = deriveBalanceChanges(block, registry);
    expect(changes.map(change => change.reason)).toEqual(["fee", "fee"]);
    expect(changes[0]).toMatchObject({ address: "akash1payer", counterpartyAddress: feeCollector, reason: "fee" });
  });

  it("classifies a block-level inflation mint from the coincident coinbase event", () => {
    const mintModule = deriveModuleAddress("mint", AKASH_ADDRESS_PREFIX);
    const block = buildBlock({
      transactions: [],
      blockEvents: [
        event("coinbase", { minter: mintModule, amount: "1000uakt" }, undefined),
        event("coin_received", { receiver: mintModule, amount: "1000uakt" }, undefined)
      ]
    });

    const changes = deriveBalanceChanges(block, registry);
    expect(changes).toEqual([
      { address: mintModule, counterpartyAddress: null, denom: "uakt", delta: 1000n, reason: "mint", height: 10, txIndex: null, eventIndex: 0 }
    ]);
  });

  it("classifies a debit coincident with a burn event as a burn", () => {
    const block = buildBlock({
      transactions: [
        buildTx({
          index: 0,
          events: [
            event("coin_spent", { spender: "akash1burner", amount: "42uakt" }, undefined),
            event("burn", { burner: "akash1burner", amount: "42uakt" }, undefined)
          ]
        })
      ]
    });

    expect(deriveBalanceChanges(block, registry)[0]).toMatchObject({ reason: "burn", delta: -42n });
  });

  it("classifies a distribution reward withdrawal using the message type at the coin's msg index", () => {
    const distribution = deriveModuleAddress("distribution", AKASH_ADDRESS_PREFIX);
    const block = buildBlock({
      transactions: [
        buildTx({
          index: 0,
          messages: [{ index: 0, typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission", body: null }],
          events: [
            event("coin_spent", { spender: distribution, amount: "8uakt", msg_index: "0" }, 0),
            event("coin_received", { receiver: "akash1val", amount: "8uakt", msg_index: "0" }, 0),
            event("transfer", { sender: distribution, recipient: "akash1val", amount: "8uakt", msg_index: "0" }, 0)
          ]
        })
      ]
    });

    const creditToValidator = deriveBalanceChanges(block, registry).find(change => change.address === "akash1val");
    expect(creditToValidator?.reason).toBe("commission");
  });

  it("ignores transfer, coinbase and message events as delta sources", () => {
    const block = buildBlock({
      transactions: [
        buildTx({
          index: 0,
          events: [
            event("transfer", { sender: "akash1a", recipient: "akash1b", amount: "1uakt" }, undefined),
            event("message", { action: "/cosmos.bank.v1beta1.MsgSend" }, undefined)
          ]
        })
      ]
    });

    expect(deriveBalanceChanges(block, registry)).toEqual([]);
  });

  function buildBlock(input: { transactions: DecodedTransaction[]; blockEvents?: DecodedEvent[] }): DecodedBlock {
    return {
      height: 10,
      datetime: new Date("2026-08-11T00:00:00Z"),
      hash: Buffer.alloc(0),
      parentHash: null,
      proposerAddress: "PROPOSER",
      transactions: input.transactions,
      blockEvents: input.blockEvents ?? []
    };
  }

  function buildTx(input: { index: number; events: DecodedEvent[]; messages?: DecodedTransaction["messages"] }): DecodedTransaction {
    return {
      index: input.index,
      hash: Buffer.alloc(0),
      code: 0,
      gasUsed: 0,
      gasWanted: 0,
      fee: [],
      messages: input.messages ?? [],
      events: input.events,
      signerAddresses: []
    };
  }

  function event(type: string, attributes: Record<string, string>, msgIndex: number | undefined): DecodedEvent {
    return msgIndex === undefined ? { type, attributes } : { type, attributes, msgIndex };
  }
});
