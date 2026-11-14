import type { TransactionEvent, TransactionEventAttribute } from "@akashnetwork/database/dbSchemas/base";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { readStakingUnbondings } from "./stakingUnbonding.helpers";

const DELEGATOR = "akash1353ewfc0v7pnn3xre6v9lraghxrhenswly2yfs";
const VALIDATOR = "akashvaloper17rzdt88vawuuq797jffk0dc9daw4vkgpumh60w";

describe(readStakingUnbondings.name, () => {
  it("reads an unbond with its delegator, validator, amount and completion time", () => {
    const events = [unbondEvent({ id: "event-1" })];

    expect(readStakingUnbondings(events)).toEqual([
      {
        kind: "parsed",
        record: {
          transactionEventId: "event-1",
          type: "unbond",
          delegator: DELEGATOR,
          validator: VALIDATOR,
          amount: "70624617",
          completionTime: new Date("2026-12-04T14:50:09Z"),
          creationHeight: null
        }
      }
    ]);
  });

  it("reads a cancellation with the creation height of the entry it cancels", () => {
    const events = [cancelEvent({ id: "event-2" })];

    expect(readStakingUnbondings(events)).toEqual([
      {
        kind: "parsed",
        record: {
          transactionEventId: "event-2",
          type: "cancel",
          delegator: DELEGATOR,
          validator: VALIDATOR,
          amount: "5000000",
          completionTime: null,
          creationHeight: 29500504
        }
      }
    ]);
  });

  it("reads every unbonding event of a transaction in order and ignores other events", () => {
    const events = [
      unbondEvent({ id: "event-1" }),
      event({ id: "event-2", type: "transfer", attributes: { amount: "1uakt" } }),
      cancelEvent({ id: "event-3" }),
      unbondEvent({ id: "event-4" })
    ];

    expect(readStakingUnbondings(events).map(change => change.kind === "parsed" && change.record.transactionEventId)).toEqual([
      "event-1",
      "event-3",
      "event-4"
    ]);
  });

  it("returns nothing for a transaction without unbonding events", () => {
    expect(readStakingUnbondings([event({ id: "event-1", type: "message", attributes: { action: "send" } })])).toEqual([]);
  });

  it("reads an event without attributes as malformed", () => {
    const events = [mock<TransactionEvent>({ id: "event-1", type: "unbond", attributes: undefined })];

    expect(readStakingUnbondings(events)).toEqual([{ kind: "malformed", eventType: "unbond" }]);
  });

  it.each([
    ["delegator", { delegator: undefined }],
    ["validator", { validator: undefined }],
    ["amount", { amount: undefined }],
    ["amount in another denom", { amount: "100uact" }],
    ["amount with a fraction", { amount: "1.5uakt" }],
    ["amount longer than the column", { amount: `${"9".repeat(31)}uakt` }],
    ["completion time", { completion_time: undefined }],
    ["unparsable completion time", { completion_time: "soon" }]
  ])("reads an unbond missing a valid %s as malformed", (_field, overrides) => {
    expect(readStakingUnbondings([unbondEvent({ id: "event-1", overrides })])).toEqual([{ kind: "malformed", eventType: "unbond" }]);
  });

  it.each([
    ["creation height", { creation_height: undefined }],
    ["numeric creation height", { creation_height: "latest" }],
    ["delegator", { delegator: "" }]
  ])("reads a cancellation missing a valid %s as malformed", (_field, overrides) => {
    expect(readStakingUnbondings([cancelEvent({ id: "event-1", overrides })])).toEqual([{ kind: "malformed", eventType: "cancel_unbonding_delegation" }]);
  });

  function unbondEvent(input: { id: string; overrides?: Record<string, string | undefined> }) {
    return event({
      id: input.id,
      type: "unbond",
      attributes: {
        validator: VALIDATOR,
        delegator: DELEGATOR,
        amount: "70624617uakt",
        completion_time: "2026-12-04T14:50:09Z",
        msg_index: "0",
        ...input.overrides
      }
    });
  }

  function cancelEvent(input: { id: string; overrides?: Record<string, string | undefined> }) {
    return event({
      id: input.id,
      type: "cancel_unbonding_delegation",
      attributes: {
        validator: VALIDATOR,
        delegator: DELEGATOR,
        amount: "5000000uakt",
        creation_height: "29500504",
        msg_index: "0",
        ...input.overrides
      }
    });
  }

  function event(input: { id: string; type: string; attributes: Record<string, string | undefined> }) {
    const attributes = Object.entries(input.attributes)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, value]) => mock<TransactionEventAttribute>({ key, value }));

    return mock<TransactionEvent>({ id: input.id, type: input.type, attributes });
  }
});
