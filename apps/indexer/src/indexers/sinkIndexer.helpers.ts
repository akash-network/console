import type { TransactionEvent } from "@akashnetwork/database/dbSchemas/base";

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

type EventAttribute = { key: string; value?: string | null };

/** Amount columns are numeric(30, 0), so a longer value would fail the insert and halt indexing. */
const AMOUNT_PATTERN = /^\d{1,30}$/;
const COUNT_PATTERN = /^\d+$/;
/** Count columns are 32-bit integers, so a larger value would fail the insert and halt indexing. */
const MAX_COUNT = 2_147_483_647;

export function findLastSinkTotalsEvent(txEvents: TransactionEvent[]): TransactionEvent | undefined {
  return txEvents
    .filter(event => event.type === SINK_TOTALS_UPDATED_EVENT_TYPE)
    .reduce<TransactionEvent | undefined>((last, event) => (last && last.index > event.index ? last : event), undefined);
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

function parseCoinAmount(value: string | null | undefined): string | null {
  const coin = parseJson(value);
  if (typeof coin !== "object" || coin === null || !("amount" in coin)) return null;

  return typeof coin.amount === "string" && AMOUNT_PATTERN.test(coin.amount) ? coin.amount : null;
}

function parseCount(value: string | null | undefined): number | null {
  const count = parseJson(value);
  if (typeof count !== "string" || !COUNT_PATTERN.test(count)) return null;

  const parsedCount = Number(count);
  return parsedCount <= MAX_COUNT ? parsedCount : null;
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
