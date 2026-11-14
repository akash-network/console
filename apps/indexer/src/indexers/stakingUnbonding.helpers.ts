import type { TransactionEvent } from "@akashnetwork/database/dbSchemas/base";

import { parseInteger } from "./sinkIndexer.helpers";

export const UNBOND_EVENT_TYPE = "unbond";
export const CANCEL_UNBONDING_EVENT_TYPE = "cancel_unbonding_delegation";

export type StakingUnbondingType = "unbond" | "cancel";

export type StakingUnbondingRecord = {
  transactionEventId: string;
  type: StakingUnbondingType;
  delegator: string;
  validator: string;
  amount: string;
  completionTime: Date | null;
  creationHeight: number | null;
};

export type StakingUnbondingChange = { kind: "parsed"; record: StakingUnbondingRecord } | { kind: "malformed"; eventType: string };

/** Amount columns are numeric(30, 0) and only the bond denom can be unbonded, so anything else would fail the insert and halt indexing. */
const UAKT_AMOUNT_PATTERN = /^(\d{1,30})uakt$/;

export function readStakingUnbondings(txEvents: TransactionEvent[]): StakingUnbondingChange[] {
  return txEvents.flatMap(event => {
    if (event.type === UNBOND_EVENT_TYPE) return [toChange(event, parseUnbond(event))];
    if (event.type === CANCEL_UNBONDING_EVENT_TYPE) return [toChange(event, parseCancellation(event))];
    return [];
  });
}

function toChange(event: TransactionEvent, record: StakingUnbondingRecord | null): StakingUnbondingChange {
  return record ? { kind: "parsed", record } : { kind: "malformed", eventType: event.type };
}

function parseUnbond(event: TransactionEvent): StakingUnbondingRecord | null {
  const values = readAttributes(event);
  const common = parseCommon(event, values);
  const completionTime = parseDate(values.get("completion_time"));
  if (!common || !completionTime) return null;

  return { ...common, type: "unbond", completionTime, creationHeight: null };
}

function parseCancellation(event: TransactionEvent): StakingUnbondingRecord | null {
  const values = readAttributes(event);
  const common = parseCommon(event, values);
  const creationHeight = parseInteger(values.get("creation_height"));
  if (!common || creationHeight === null) return null;

  return { ...common, type: "cancel", completionTime: null, creationHeight };
}

function parseCommon(event: TransactionEvent, values: Map<string, string | null | undefined>) {
  const delegator = values.get("delegator");
  const validator = values.get("validator");
  const amount = UAKT_AMOUNT_PATTERN.exec(values.get("amount") ?? "")?.[1];
  if (!delegator || !validator || !amount) return null;

  return { transactionEventId: event.id, delegator, validator, amount };
}

function readAttributes(event: TransactionEvent) {
  return new Map((event.attributes ?? []).map(attribute => [attribute.key, attribute.value]));
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
