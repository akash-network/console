import { describe, expect, it } from "vitest";

import type { SinkTransferState, SinkTransferStatus, SinkTransferStatusChange } from "./sinkTransfer.helpers";
import { applySinkTransferChange, readSinkTransferChanges } from "./sinkTransfer.helpers";

const KEY = { height: 29448411, sequence: 1 };
const OWNER = "akash1z6ql8ryp2sjdw2wgvrrwc0sm5u2yn4ghqxj4rl";
const RECIPIENT = "CA7haEbmqKYBY7XtQLQzhDYHH1fNrf7Gop3Xshq7Qa8v";

describe(readSinkTransferChanges.name, () => {
  it("reads a created transfer with its owner, recipient and amount", () => {
    expect(readSinkTransferChanges([createdEvent()])).toEqual([{ kind: "created", key: KEY, owner: OWNER, recipient: RECIPIENT, amount: "10000000" }]);
  });

  it("reads each status event under the transfer's creation height and sequence", () => {
    const events = [
      sinkEvent("EventVoidOrdered"),
      sinkEvent("EventMintConfirmed"),
      sinkEvent("EventVoidConfirmed", { challenge_end: '"2026-11-13T00:00:00Z"' }),
      sinkEvent("EventTransferRefunded", { sender: JSON.stringify(OWNER) })
    ];

    expect(readSinkTransferChanges(events)).toEqual([
      { kind: "voidOrdered", key: KEY },
      { kind: "mintConfirmed", key: KEY },
      { kind: "voidConfirmed", key: KEY },
      { kind: "refunded", key: KEY }
    ]);
  });

  it.each([
    ["DECISION_RESTART", "restart"],
    ["DECISION_CONFIRM_MINT", "confirmMint"],
    ["DECISION_CONFIRM_VOID", "confirmVoid"]
  ])("reads a %s resolution", (decision, resolution) => {
    const events = [sinkEvent("EventTransferResolved", { decision: JSON.stringify(decision) })];

    expect(readSinkTransferChanges(events)).toEqual([{ kind: "resolved", key: KEY, resolution }]);
  });

  it("ignores events that do not describe a transfer", () => {
    const events = [sinkEvent("EventTotalsUpdated"), sinkEvent("EventVoidVetoed"), { type: "coin_spent", attributes: [] }, { type: "message" }];

    expect(readSinkTransferChanges(events)).toEqual([]);
  });

  describe("when a reporter reports an outcome", () => {
    it("reads a report on its own as a report without settlement", () => {
      expect(readSinkTransferChanges([sinkEvent("EventOutcomeReported")])).toEqual([{ kind: "reportedWithoutSettlement", key: KEY }]);
    });

    it.each([
      ["EventMintConfirmed", [{ kind: "mintConfirmed", key: KEY }]],
      ["EventVoidConfirmed", [{ kind: "voidConfirmed", key: KEY }]],
      ["EventReportConflict", []]
    ])("reads nothing more for a report that follows %s of the same transfer", (settlementEvent, expectedChanges) => {
      const events = [sinkEvent(settlementEvent), sinkEvent("EventTotalsUpdated"), sinkEvent("EventOutcomeReported")];

      expect(readSinkTransferChanges(events)).toEqual(expectedChanges);
    });

    it.each([
      ["a different sequence", { height: KEY.height, sequence: 2 }],
      ["a different height", { height: 29448412, sequence: KEY.sequence }]
    ])("reads a report without settlement when the confirmation belongs to a transfer with %s", (_difference, otherKey) => {
      const events = [sinkEvent("EventMintConfirmed", {}, otherKey), sinkEvent("EventOutcomeReported")];

      expect(readSinkTransferChanges(events)).toEqual([
        { kind: "mintConfirmed", key: otherKey },
        { kind: "reportedWithoutSettlement", key: KEY }
      ]);
    });

    it("pairs a confirmation with the first report that follows it only", () => {
      const events = [sinkEvent("EventMintConfirmed"), sinkEvent("EventOutcomeReported"), sinkEvent("EventOutcomeReported")];

      expect(readSinkTransferChanges(events)).toEqual([
        { kind: "mintConfirmed", key: KEY },
        { kind: "reportedWithoutSettlement", key: KEY }
      ]);
    });

    it("does not pair a report with a void order or a creation of the same transfer", () => {
      const events = [createdEvent(), sinkEvent("EventVoidOrdered"), sinkEvent("EventOutcomeReported")];

      expect(readSinkTransferChanges(events).map(change => change.kind)).toEqual(["created", "voidOrdered", "reportedWithoutSettlement"]);
    });
  });

  describe("when an event is malformed", () => {
    it.each([
      ["has no attributes", undefined],
      ["has no id", {}],
      ["has an id that is not JSON", { id: "{" }],
      ["has an id that is not an object", { id: '"29448411"' }],
      ["has a null id", { id: "null" }],
      ["has an id without a height", { id: JSON.stringify({ owner: OWNER, sequence: "1" }) }],
      ["has an id without a sequence", { id: JSON.stringify({ owner: OWNER, height: "29448411" }) }],
      ["has a numeric height", { id: JSON.stringify({ owner: OWNER, height: 29448411, sequence: "1" }) }],
      ["has a negative sequence", { id: JSON.stringify({ owner: OWNER, height: "29448411", sequence: "-1" }) }],
      ["has a height above the integer column range", { id: JSON.stringify({ owner: OWNER, height: "2147483648", sequence: "1" }) }]
    ])("flags a status event that %s", (_reason, attributes) => {
      const event = { type: "akash.sink.v1.EventMintConfirmed", attributes: attributes && toAttributes(attributes) };

      expect(readSinkTransferChanges([event])).toEqual([{ kind: "malformed", eventType: "akash.sink.v1.EventMintConfirmed" }]);
    });

    it("accepts the largest height and sequence the integer columns hold", () => {
      const key = { height: 2147483647, sequence: 2147483647 };

      expect(readSinkTransferChanges([sinkEvent("EventMintConfirmed", {}, key)])).toEqual([{ kind: "mintConfirmed", key }]);
    });

    it.each(["EventReportConflict", "EventOutcomeReported"])("flags %s without a readable id", eventName => {
      const event = { type: `akash.sink.v1.${eventName}`, attributes: [] };

      expect(readSinkTransferChanges([event])).toEqual([{ kind: "malformed", eventType: `akash.sink.v1.${eventName}` }]);
    });

    it.each([
      ["no owner", { id: JSON.stringify({ height: "29448411", sequence: "1" }) }],
      ["an empty owner", { id: JSON.stringify({ owner: "", height: "29448411", sequence: "1" }) }],
      ["an owner that is not a string", { id: JSON.stringify({ owner: 7, height: "29448411", sequence: "1" }) }],
      ["an owner longer than the address column", { id: JSON.stringify({ owner: "a".repeat(256), height: "29448411", sequence: "1" }) }],
      ["no recipient", { recipient: undefined }],
      ["an empty recipient", { recipient: '""' }],
      ["a recipient longer than the address column", { recipient: JSON.stringify("S".repeat(256)) }],
      ["no amount", { amount: undefined }],
      ["an amount that is not a number", { amount: JSON.stringify({ denom: "uakt", amount: "ten" }) }],
      ["an amount longer than the amount column", { amount: JSON.stringify({ denom: "uakt", amount: "1".repeat(31) }) }]
    ])("flags a created transfer with %s", (_reason, overrides) => {
      expect(readSinkTransferChanges([createdEvent(overrides)])).toEqual([{ kind: "malformed", eventType: "akash.sink.v1.EventTransferCreated" }]);
    });

    it("accepts addresses as long as the address column", () => {
      const owner = "a".repeat(255);
      const recipient = "S".repeat(255);
      const event = createdEvent({ id: JSON.stringify({ owner, height: "29448411", sequence: "1" }), recipient: JSON.stringify(recipient) });

      expect(readSinkTransferChanges([event])).toEqual([{ kind: "created", key: KEY, owner, recipient, amount: "10000000" }]);
    });

    it.each([
      ["no decision", {}],
      ["an unknown decision", { decision: '"DECISION_INVALID"' }],
      ["a numeric decision", { decision: "1" }],
      ["a decision named after an object property", { decision: '"constructor"' }]
    ])("flags a resolution with %s", (_reason, attributes) => {
      expect(readSinkTransferChanges([sinkEvent("EventTransferResolved", attributes)])).toEqual([
        { kind: "malformed", eventType: "akash.sink.v1.EventTransferResolved" }
      ]);
    });

    it("keeps reading the events that follow a malformed one", () => {
      const events = [{ type: "akash.sink.v1.EventMintConfirmed", attributes: [] }, sinkEvent("EventTransferRefunded")];

      expect(readSinkTransferChanges(events)).toEqual([
        { kind: "malformed", eventType: "akash.sink.v1.EventMintConfirmed" },
        { kind: "refunded", key: KEY }
      ]);
    });
  });

  function createdEvent(overrides: Record<string, string | undefined> = {}) {
    return sinkEvent("EventTransferCreated", {
      sender: JSON.stringify(OWNER),
      recipient: JSON.stringify(RECIPIENT),
      amount: JSON.stringify({ denom: "uakt", amount: "10000000" }),
      height: '"29448411"',
      ...overrides
    });
  }

  function sinkEvent(eventName: string, attributes: Record<string, string | undefined> = {}, key = KEY) {
    const id = JSON.stringify({ owner: OWNER, height: String(key.height), sequence: String(key.sequence) });

    return { type: `akash.sink.v1.${eventName}`, attributes: toAttributes({ id, msg_index: "0", ...attributes }) };
  }

  function toAttributes(values: Record<string, string | undefined>) {
    return Object.entries(values).map(([key, value]) => ({ key, value }));
  }
});

describe(applySinkTransferChange.name, () => {
  const ALL_STATUSES: SinkTransferStatus[] = ["pending", "minted", "voided", "refund_pending", "refunded"];

  describe("voidOrdered", () => {
    it("voids a pending transfer and records the void order", () => {
      expect(apply({ status: "pending", hasVoidOrder: false }, { kind: "voidOrdered" })).toEqual({ status: "voided", hasVoidOrder: true });
    });

    it.each(["minted", "voided", "refund_pending", "refunded"] as const)("records the void order on a %s transfer without changing its status", status => {
      expect(apply({ status, hasVoidOrder: false }, { kind: "voidOrdered" })).toEqual({ status, hasVoidOrder: true });
    });
  });

  it.each(ALL_STATUSES)("marks a %s transfer as minted once its mint is confirmed", status => {
    expect(apply({ status, hasVoidOrder: true }, { kind: "mintConfirmed" })).toEqual({ status: "minted", hasVoidOrder: true });
  });

  it.each(ALL_STATUSES)("marks a %s transfer as awaiting its refund once its void is confirmed", status => {
    expect(apply({ status, hasVoidOrder: false }, { kind: "voidConfirmed" })).toEqual({ status: "refund_pending", hasVoidOrder: false });
  });

  it.each(ALL_STATUSES)("marks a %s transfer as refunded once its refund is paid", status => {
    expect(apply({ status, hasVoidOrder: true }, { kind: "refunded" })).toEqual({ status: "refunded", hasVoidOrder: true });
  });

  describe("reportedWithoutSettlement", () => {
    it("returns a transfer awaiting its refund to pending when it has no void order", () => {
      expect(apply({ status: "refund_pending", hasVoidOrder: false }, { kind: "reportedWithoutSettlement" })).toEqual({
        status: "pending",
        hasVoidOrder: false
      });
    });

    it("returns a transfer awaiting its refund to voided when it has a void order", () => {
      expect(apply({ status: "refund_pending", hasVoidOrder: true }, { kind: "reportedWithoutSettlement" })).toEqual({
        status: "voided",
        hasVoidOrder: true
      });
    });

    it.each(["pending", "minted", "voided", "refunded"] as const)("leaves a %s transfer unchanged", status => {
      const transfer = { status, hasVoidOrder: true };

      expect(apply(transfer, { kind: "reportedWithoutSettlement" })).toBe(transfer);
    });
  });

  describe("resolved", () => {
    it.each(ALL_STATUSES)("restarts a %s transfer as pending when it has no void order", status => {
      expect(apply({ status, hasVoidOrder: false }, { kind: "resolved", resolution: "restart" })).toEqual({ status: "pending", hasVoidOrder: false });
    });

    it.each(ALL_STATUSES)("restarts a %s transfer as voided when it has a void order", status => {
      expect(apply({ status, hasVoidOrder: true }, { kind: "resolved", resolution: "restart" })).toEqual({ status: "voided", hasVoidOrder: true });
    });

    it.each(ALL_STATUSES)("marks a %s transfer as minted when governance confirms the mint", status => {
      expect(apply({ status, hasVoidOrder: true }, { kind: "resolved", resolution: "confirmMint" })).toEqual({ status: "minted", hasVoidOrder: true });
    });

    it.each(["pending", "minted", "voided", "refund_pending"] as const)(
      "marks a %s transfer as awaiting its refund when governance confirms the void",
      status => {
        expect(apply({ status, hasVoidOrder: true }, { kind: "resolved", resolution: "confirmVoid" })).toEqual({
          status: "refund_pending",
          hasVoidOrder: true
        });
      }
    );

    it("keeps a refunded transfer refunded when governance confirms the void", () => {
      expect(apply({ status: "refunded", hasVoidOrder: true }, { kind: "resolved", resolution: "confirmVoid" })).toEqual({
        status: "refunded",
        hasVoidOrder: true
      });
    });
  });

  function apply(
    transfer: SinkTransferState,
    change: { kind: Exclude<SinkTransferStatusChange["kind"], "resolved"> } | { kind: "resolved"; resolution: "restart" | "confirmMint" | "confirmVoid" }
  ) {
    return applySinkTransferChange(transfer, { ...change, key: KEY });
  }
});
