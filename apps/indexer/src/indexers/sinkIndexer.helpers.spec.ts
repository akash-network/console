import type { TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EventType } from "@src/shared/types";
import { findBlockLevelSinkTotalsEvents, findLastSinkTotalsEvent, parseSinkTotals, SINK_TOTALS_UPDATED_EVENT_TYPE } from "./sinkIndexer.helpers";

describe(findLastSinkTotalsEvent.name, () => {
  it("returns undefined when the transaction emitted no sink totals event", () => {
    const events = [mock<TransactionEvent>({ type: "akash.sink.v1.EventTransferCreated", index: 3 })];

    expect(findLastSinkTotalsEvent(events)).toBeUndefined();
  });

  it("returns the sink totals event with the highest index whatever the order of the events", () => {
    const first = mock<TransactionEvent>({ type: SINK_TOTALS_UPDATED_EVENT_TYPE, index: 4 });
    const last = mock<TransactionEvent>({ type: SINK_TOTALS_UPDATED_EVENT_TYPE, index: 9 });
    const unrelated = mock<TransactionEvent>({ type: "message", index: 12 });

    expect(findLastSinkTotalsEvent([last, first, unrelated])).toBe(last);
    expect(findLastSinkTotalsEvent([first, unrelated, last])).toBe(last);
  });
});

describe(findBlockLevelSinkTotalsEvents.name, () => {
  it("finds no event in a block without a sink totals event", () => {
    const events = [blockEvent({ type: "coin_spent", mode: "BeginBlock" }), blockEvent({ type: "akash.sink.v1.EventVoidOrdered", mode: "EndBlock" })];

    expect(findBlockLevelSinkTotalsEvents(events)).toEqual({ beforeTransactions: undefined, afterTransactions: undefined });
  });

  it("returns the last totals event emitted on each side of the block's transactions", () => {
    const firstBeginBlock = blockEvent({ type: SINK_TOTALS_UPDATED_EVENT_TYPE, mode: "BeginBlock" });
    const lastBeginBlock = blockEvent({ type: SINK_TOTALS_UPDATED_EVENT_TYPE, mode: "BeginBlock" });
    const firstEndBlock = blockEvent({ type: SINK_TOTALS_UPDATED_EVENT_TYPE, mode: "EndBlock" });
    const lastEndBlock = blockEvent({ type: SINK_TOTALS_UPDATED_EVENT_TYPE, mode: "EndBlock" });
    const unrelated = blockEvent({ type: "akash.oracle.v2.EventAggregatedPrice", mode: "EndBlock" });

    const found = findBlockLevelSinkTotalsEvents([firstBeginBlock, lastBeginBlock, firstEndBlock, lastEndBlock, unrelated]);

    expect(found.beforeTransactions).toBe(lastBeginBlock);
    expect(found.afterTransactions).toBe(lastEndBlock);
  });

  it("places a totals event without a mode before the block's transactions", () => {
    const withoutMode = blockEvent({ type: SINK_TOTALS_UPDATED_EVENT_TYPE });

    expect(findBlockLevelSinkTotalsEvents([withoutMode])).toEqual({ beforeTransactions: withoutMode, afterTransactions: undefined });
  });

  it("reads the mode from the mode attribute only", () => {
    const mentionsEndBlockElsewhere: EventType = {
      type: SINK_TOTALS_UPDATED_EVENT_TYPE,
      attributes: [
        { key: "memo", value: "EndBlock", index: true },
        { key: "mode", value: "BeginBlock", index: true }
      ]
    };

    expect(findBlockLevelSinkTotalsEvents([mentionsEndBlockElsewhere])).toEqual({
      beforeTransactions: mentionsEndBlockElsewhere,
      afterTransactions: undefined
    });
  });

  function blockEvent(input: { type: string; mode?: string }): EventType {
    return { type: input.type, attributes: input.mode ? [{ key: "mode", value: input.mode, index: true }] : [] };
  }
});

describe(parseSinkTotals.name, () => {
  it("reads every amount and count of a totals event", () => {
    expect(parseSinkTotals(totalsAttributes())).toEqual({
      pendingAmount: "10000000",
      pendingCount: 1,
      mintedAmount: "1612541902979",
      mintedCount: 27,
      voidedAmount: "3000000",
      voidedCount: 2,
      refundPendingAmount: "4000000",
      refundPendingCount: 3,
      refundedAmount: "5000000",
      refundedCount: 4
    });
  });

  it("keeps an amount beyond the safe integer range as an exact string", () => {
    const totals = parseSinkTotals(totalsAttributes({ minted_amount: coin("123456789012345678901234567890") }));

    expect(totals?.mintedAmount).toBe("123456789012345678901234567890");
  });

  it("accepts the largest count a 32-bit column holds", () => {
    const totals = parseSinkTotals(totalsAttributes({ minted_count: '"2147483647"' }));

    expect(totals?.mintedCount).toBe(2147483647);
  });

  it.each([
    ["an amount attribute is missing", { pending_amount: undefined }],
    ["a count attribute is missing", { refunded_count: undefined }],
    ["an amount attribute is empty", { minted_amount: "" }],
    ["an amount is not valid JSON", { minted_amount: "{" }],
    ["an amount is JSON null", { minted_amount: "null" }],
    ["an amount is not a coin", { minted_amount: '"10"' }],
    ["a coin has no amount", { voided_amount: '{"denom":"uakt"}' }],
    ["a coin amount is a number", { voided_amount: '{"denom":"uakt","amount":10}' }],
    ["a coin amount is negative", { refunded_amount: coin("-1") }],
    ["a coin amount has a fraction", { refund_pending_amount: coin("1.5") }],
    ["a coin amount has trailing characters", { refund_pending_amount: coin("15uakt") }],
    ["a coin amount has leading characters", { refund_pending_amount: coin("x15") }],
    ["a coin amount is longer than the column holds", { minted_amount: coin("1".repeat(31)) }],
    ["a count is not JSON-quoted", { pending_count: "1" }],
    ["a count is negative", { minted_count: '"-1"' }],
    ["a count has a fraction", { voided_count: '"1.5"' }],
    ["a count has trailing characters", { voided_count: '"1x"' }],
    ["a count has leading characters", { voided_count: '"x1"' }],
    ["a count is larger than the column holds", { refund_pending_count: '"2147483648"' }]
  ])("returns null when %s", (_reason, overrides) => {
    expect(parseSinkTotals(totalsAttributes(overrides))).toBeNull();
  });

  function coin(amount: string) {
    return JSON.stringify({ denom: "uakt", amount });
  }

  function totalsAttributes(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      minted_amount: coin("1612541902979"),
      minted_count: '"27"',
      pending_amount: coin("10000000"),
      pending_count: '"1"',
      refund_pending_amount: coin("4000000"),
      refund_pending_count: '"3"',
      refunded_amount: coin("5000000"),
      refunded_count: '"4"',
      refunded_in_epoch: coin("0"),
      voided_amount: coin("3000000"),
      voided_count: '"2"',
      msg_index: "0",
      ...overrides
    };

    return Object.entries(values).flatMap(([key, value]) => (value === undefined ? [] : [{ key, value }]));
  }
});
