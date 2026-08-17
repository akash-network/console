import { describe, expect, it } from "vitest";

import { collectBmeAddresses, deriveBmeChanges } from "@src/bme/bme-deriver";
import type { DecodedBlock, DecodedEvent } from "@src/pipeline/decoded-block";

const BLOCK_TIME = new Date("2026-08-13T00:00:00Z");

const EXECUTED_EVENT_TYPE = "akash.bme.v1.EventLedgerRecordExecuted";
const STATUS_CHANGE_EVENT_TYPE = "akash.bme.v1.EventMintStatusChange";
const CANCELED_EVENT_TYPE = "akash.bme.v1.EventLedgerRecordCanceled";

describe("deriveBmeChanges", () => {
  it("derives an executed mint record (uakt to uact) from a block event", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event(EXECUTED_EVENT_TYPE, {
            id: '{"denom":"uakt","to_denom":"uact","source":"bme","height":12000,"sequence":3}',
            burned_from: '"akash1burner"',
            minted_to: '"akash1minter"',
            burned: '{"coin":{"denom":"uakt","amount":"1000000"},"price":"1.150000000000000000"}',
            minted: '{"coin":{"denom":"uact","amount":"1150000"},"price":"1.000000000000000000"}',
            spread: '{"denom":"uakt","amount":"25"}',
            remint_credit_accrued: '{"coin":{"denom":"uakt","amount":"1000000"},"price":"1.150000000000000000"}'
          })
        ]
      })
    );

    expect(changes.warnings).toEqual([]);
    expect(changes.changes).toEqual([
      {
        kind: "ledgerRecordExecuted",
        id: { denom: "uakt", toDenom: "uact", source: "bme", recordHeight: 12000, sequence: 3 },
        burnedFrom: "akash1burner",
        mintedTo: "akash1minter",
        burned: { denom: "uakt", amount: "1000000", price: "1.150000000000000000" },
        minted: { denom: "uact", amount: "1150000", price: "1.000000000000000000" },
        spread: { denom: "uakt", amount: "25" },
        remintCreditIssued: null,
        remintCreditAccrued: { denom: "uakt", amount: "1000000", price: "1.150000000000000000" },
        txIndex: null,
        ordinal: 0
      }
    ]);
  });

  it("treats JSON-null coin attributes as absent, matching the wire shape of a pure mint", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event(EXECUTED_EVENT_TYPE, {
            id: '{"denom":"uakt","to_denom":"uact","source":"akash1requester","height":"4844258","sequence":"1"}',
            burned: "null",
            burned_from: '"akash1requester"',
            minted: '{"coin":{"denom":"uact","amount":"10529003"},"price":"1.000000000000000000"}',
            minted_to: '"akash1requester"',
            remint_credit_accrued: '{"coin":{"denom":"uakt","amount":"20000000"},"price":"0.526450156686029160"}',
            remint_credit_issued: "null",
            spread: '{"denom":"uact","amount":"26322"}'
          })
        ]
      })
    );

    expect(changes.warnings).toEqual([]);
    expect(changes.changes).toEqual([
      expect.objectContaining({
        kind: "ledgerRecordExecuted",
        id: { denom: "uakt", toDenom: "uact", source: "akash1requester", recordHeight: 4844258, sequence: 1 },
        burned: null,
        minted: { denom: "uact", amount: "10529003", price: "1.000000000000000000" },
        spread: { denom: "uact", amount: "26322" },
        remintCreditIssued: null,
        remintCreditAccrued: { denom: "uakt", amount: "20000000", price: "0.526450156686029160" }
      })
    ]);
  });

  it("derives an executed burn record (uact to uakt) with remint credit issued", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event(EXECUTED_EVENT_TYPE, {
            id: '{"denom":"uact","to_denom":"uakt","source":"bme","height":"12100","sequence":"4"}',
            burned_from: '"akash1burner"',
            minted_to: '"akash1minter"',
            burned: '{"coin":{"denom":"uact","amount":"500000"},"price":"1.000000000000000000"}',
            minted: '{"coin":{"denom":"uakt","amount":"434782"},"price":"1.150000000000000000"}',
            remint_credit_issued: '{"coin":{"denom":"uakt","amount":"434782"},"price":"1.150000000000000000"}'
          })
        ]
      })
    );

    expect(changes.warnings).toEqual([]);
    expect(changes.changes).toEqual([
      expect.objectContaining({
        kind: "ledgerRecordExecuted",
        id: { denom: "uact", toDenom: "uakt", source: "bme", recordHeight: 12100, sequence: 4 },
        burned: { denom: "uact", amount: "500000", price: "1.000000000000000000" },
        remintCreditIssued: { denom: "uakt", amount: "434782", price: "1.150000000000000000" },
        remintCreditAccrued: null,
        spread: null
      })
    ]);
  });

  it("passes IBC denoms and unquoted address attributes through raw", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event(EXECUTED_EVENT_TYPE, {
            id: '{"denom":"ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1","to_denom":"uact","source":"bme","height":9000,"sequence":1}',
            burned_from: "akash1burner",
            minted_to: "akash1minter",
            burned: '{"coin":{"denom":"ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1","amount":"7"},"price":"1.000000000000000000"}'
          })
        ]
      })
    );

    expect(changes.warnings).toEqual([]);
    expect(changes.changes).toEqual([
      expect.objectContaining({
        id: expect.objectContaining({ denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1" }),
        burnedFrom: "akash1burner",
        mintedTo: "akash1minter",
        burned: expect.objectContaining({ amount: "7" }),
        minted: null
      })
    ]);
  });

  it("derives a mint status change with JSON-quoted enum names and Dec ratio", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event(STATUS_CHANGE_EVENT_TYPE, {
            previous_status: '"mint_status_healthy"',
            new_status: '"mint_status_warning"',
            collateral_ratio: '"1.750000000000000000"'
          })
        ]
      })
    );

    expect(changes.warnings).toEqual([]);
    expect(changes.changes).toEqual([
      {
        kind: "mintStatusChange",
        previousStatus: "mint_status_healthy",
        newStatus: "mint_status_warning",
        collateralRatio: "1.750000000000000000",
        txIndex: null,
        ordinal: 0
      }
    ]);
  });

  it("rejects a status change with a value outside the known mint statuses", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event(STATUS_CHANGE_EVENT_TYPE, {
            previous_status: '"mint_status_healthy"',
            new_status: '"mint_status_brand_new"',
            collateral_ratio: '"1.75"'
          })
        ]
      })
    );

    expect(changes.changes).toEqual([]);
    expect(changes.warnings).toHaveLength(1);
    expect(changes.warnings[0]).toContain(STATUS_CHANGE_EVENT_TYPE);
  });

  it("derives a canceled record", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event(CANCELED_EVENT_TYPE, {
            id: '{"denom":"uakt","to_denom":"uact","source":"bme","height":12000,"sequence":5}',
            cancel_reason: '"insufficient_funds"',
            owner: '"akash1owner"',
            to: '"akash1dest"',
            coins_to_burn: '{"denom":"uakt","amount":"42"}',
            denom_to_mint: '"uact"'
          })
        ]
      })
    );

    expect(changes.warnings).toEqual([]);
    expect(changes.changes).toEqual([
      {
        kind: "ledgerRecordCanceled",
        id: { denom: "uakt", toDenom: "uact", source: "bme", recordHeight: 12000, sequence: 5 },
        cancelReason: "insufficient_funds",
        owner: "akash1owner",
        to: "akash1dest",
        coinsToBurn: { denom: "uakt", amount: "42" },
        denomToMint: "uact",
        txIndex: null,
        ordinal: 0
      }
    ]);
  });

  it("assigns ordinals across transaction events then block events in scan order", () => {
    const changes = deriveBmeChanges(
      block({
        txEvents: [event(STATUS_CHANGE_EVENT_TYPE, statusChangeAttributes())],
        blockEvents: [
          event(EXECUTED_EVENT_TYPE, executedAttributes({ sequence: 1 })),
          event(STATUS_CHANGE_EVENT_TYPE, statusChangeAttributes()),
          event(EXECUTED_EVENT_TYPE, executedAttributes({ sequence: 2 }))
        ]
      })
    );

    expect(changes.changes.map(change => [change.kind, change.txIndex, change.ordinal])).toEqual([
      ["mintStatusChange", 0, 0],
      ["ledgerRecordExecuted", null, 1],
      ["mintStatusChange", null, 2],
      ["ledgerRecordExecuted", null, 3]
    ]);
  });

  it("skips events of failed transactions but keeps block events", () => {
    const changes = deriveBmeChanges(
      block({
        code: 1,
        txEvents: [event(STATUS_CHANGE_EVENT_TYPE, statusChangeAttributes())],
        blockEvents: [event(EXECUTED_EVENT_TYPE, executedAttributes({ sequence: 1 }))]
      })
    );

    expect(changes.changes.map(change => [change.kind, change.ordinal])).toEqual([["ledgerRecordExecuted", 0]]);
  });

  it("drops an event with a malformed id, keeps its ordinal slot and derives the rest", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event(EXECUTED_EVENT_TYPE, { ...executedAttributes({ sequence: 1 }), id: "not-json" }),
          event(EXECUTED_EVENT_TYPE, executedAttributes({ sequence: 2 }))
        ]
      })
    );

    expect(changes.warnings).toHaveLength(1);
    expect(changes.warnings[0]).toContain(EXECUTED_EVENT_TYPE);
    expect(changes.changes.map(change => [change.kind, change.ordinal])).toEqual([["ledgerRecordExecuted", 1]]);
  });

  it("drops an executed event missing a party address", () => {
    const attributes = executedAttributes({ sequence: 1 });
    delete (attributes as Record<string, string | undefined>).minted_to;

    const changes = deriveBmeChanges(block({ blockEvents: [event(EXECUTED_EVENT_TYPE, attributes)] }));

    expect(changes.changes).toEqual([]);
    expect(changes.warnings).toHaveLength(1);
  });

  it("drops an executed event whose coin amount is not an integer string", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event(EXECUTED_EVENT_TYPE, {
            ...executedAttributes({ sequence: 1 }),
            burned: '{"coin":{"denom":"uakt","amount":"1.5"},"price":"1.0"}'
          })
        ]
      })
    );

    expect(changes.changes).toEqual([]);
    expect(changes.warnings).toHaveLength(1);
  });

  it("ignores vault funded and unrelated events", () => {
    const changes = deriveBmeChanges(
      block({
        blockEvents: [
          event("akash.bme.v1.EventVaultFunded", {
            amount: '{"denom":"uakt","amount":"100"}',
            source: '"bme"',
            new_vault_balance: '{"denom":"uakt","amount":"5000"}'
          }),
          event("transfer", { sender: "a", recipient: "b", amount: "1uakt" })
        ]
      })
    );

    expect(changes.changes).toEqual([]);
    expect(changes.warnings).toEqual([]);
  });
});

describe("collectBmeAddresses", () => {
  it("collects executed record parties and canceled record owner and destination", () => {
    const executed = deriveBmeChanges(block({ blockEvents: [event(EXECUTED_EVENT_TYPE, executedAttributes({ sequence: 1 }))] }));
    const canceled = deriveBmeChanges(
      block({
        height: 101,
        blockEvents: [
          event(CANCELED_EVENT_TYPE, {
            id: '{"denom":"uakt","to_denom":"uact","source":"bme","height":12000,"sequence":5}',
            cancel_reason: '"epsilon"',
            owner: '"akash1owner"',
            to: '"akash1dest"',
            denom_to_mint: '"uact"'
          })
        ]
      })
    );

    expect(collectBmeAddresses([executed, canceled])).toEqual(new Set(["akash1burner", "akash1minter", "akash1owner", "akash1dest"]));
  });
});

function executedAttributes(input: { sequence: number }): Record<string, string> {
  return {
    id: `{"denom":"uakt","to_denom":"uact","source":"bme","height":12000,"sequence":${input.sequence}}`,
    burned_from: '"akash1burner"',
    minted_to: '"akash1minter"',
    burned: '{"coin":{"denom":"uakt","amount":"1000000"},"price":"1.150000000000000000"}',
    minted: '{"coin":{"denom":"uact","amount":"1150000"},"price":"1.000000000000000000"}'
  };
}

function statusChangeAttributes(): Record<string, string> {
  return {
    previous_status: '"mint_status_healthy"',
    new_status: '"mint_status_warning"',
    collateral_ratio: '"1.750000000000000000"'
  };
}

function block(input: { height?: number; code?: number; txEvents?: DecodedEvent[]; blockEvents?: DecodedEvent[] }): DecodedBlock {
  return {
    height: input.height ?? 100,
    datetime: BLOCK_TIME,
    hash: Buffer.alloc(0),
    parentHash: null,
    proposerAddress: "P",
    transactions: input.txEvents
      ? [
          {
            index: 0,
            hash: Buffer.alloc(0),
            code: input.code ?? 0,
            gasUsed: 0,
            gasWanted: 0,
            fee: [],
            messages: [],
            events: input.txEvents,
            signerAddresses: []
          }
        ]
      : [],
    blockEvents: input.blockEvents ?? []
  };
}

function event(type: string, attributes: Record<string, string>, msgIndex?: number): DecodedEvent {
  return msgIndex === undefined ? { type, attributes } : { type, attributes, msgIndex };
}
