import type { TransactionEvent } from "@akashnetwork/database/dbSchemas/base";

import type { EventType } from "@src/shared/types";

export const SINK_TOTALS_UPDATED_EVENT_TYPE = "akash.sink.v1.EventTotalsUpdated";

export type SinkTotals = {
  pendingAmount: string;
  pendingCount: number;
  mintedAmount: string;
  mintedCount: number;
  voidedAmount: string;
  voidedCount: number;
  refundPendingAmount: string;
  refundPendingCount: number;
  refundedAmount: string;
  refundedCount: number;
};

export type EventAttribute = { key: string; value?: string | null };

/** Amount columns are numeric(30, 0), so a longer value would fail the insert and halt indexing. */
const AMOUNT_PATTERN = /^\d{1,30}$/;
const INTEGER_PATTERN = /^\d+$/;
/** Integer columns are 32-bit, so a larger value would fail the insert and halt indexing. */
const MAX_INTEGER = 2_147_483_647;

export function findLastSinkTotalsEvent(txEvents: TransactionEvent[]): TransactionEvent | undefined {
  return txEvents
    .filter(event => event.type === SINK_TOTALS_UPDATED_EVENT_TYPE)
    .reduce<TransactionEvent | undefined>((last, event) => (last && last.index > event.index ? last : event), undefined);
}

export function findBlockLevelSinkTotalsEvents(blockEvents: EventType[]): { beforeTransactions?: EventType; afterTransactions?: EventType } {
  const totalsEvents = blockEvents.filter(event => event.type === SINK_TOTALS_UPDATED_EVENT_TYPE);

  return {
    beforeTransactions: totalsEvents.findLast(event => !isEmittedAfterTransactions(event)),
    afterTransactions: totalsEvents.findLast(isEmittedAfterTransactions)
  };
}

function isEmittedAfterTransactions(blockEvent: EventType) {
  return blockEvent.attributes.some(attribute => attribute.key === "mode" && attribute.value === "EndBlock");
}

export function parseSinkTotals(attributes: EventAttribute[]): SinkTotals | null {
  const values = new Map(attributes.map(attribute => [attribute.key, attribute.value]));
  const totals = {
    pendingAmount: parseCoinAmount(values.get("pending_amount")),
    pendingCount: parseCount(values.get("pending_count")),
    mintedAmount: parseCoinAmount(values.get("minted_amount")),
    mintedCount: parseCount(values.get("minted_count")),
    voidedAmount: parseCoinAmount(values.get("voided_amount")),
    voidedCount: parseCount(values.get("voided_count")),
    refundPendingAmount: parseCoinAmount(values.get("refund_pending_amount")),
    refundPendingCount: parseCount(values.get("refund_pending_count")),
    refundedAmount: parseCoinAmount(values.get("refunded_amount")),
    refundedCount: parseCount(values.get("refunded_count"))
  };

  return isComplete(totals) ? totals : null;
}

function isComplete(totals: { [K in keyof SinkTotals]: SinkTotals[K] | null }): totals is SinkTotals {
  return Object.values(totals).every(value => value !== null);
}

export function parseCoinAmount(value: string | null | undefined): string | null {
  const coin = parseJson(value);
  if (typeof coin !== "object" || coin === null || !("amount" in coin)) return null;

  return typeof coin.amount === "string" && AMOUNT_PATTERN.test(coin.amount) ? coin.amount : null;
}

function parseCount(value: string | null | undefined): number | null {
  return parseInteger(parseJson(value));
}

export function parseInteger(value: unknown): number | null {
  if (typeof value !== "string" || !INTEGER_PATTERN.test(value)) return null;

  const integer = Number(value);
  return integer <= MAX_INTEGER ? integer : null;
}

export function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
