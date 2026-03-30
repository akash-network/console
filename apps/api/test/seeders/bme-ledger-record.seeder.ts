import { faker } from "@faker-js/faker";
import { merge } from "lodash";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";

type LedgerResponse = Awaited<ReturnType<ChainSDK["akash"]["bme"]["v1"]["getLedgerRecords"]>>;
type LedgerRecord = LedgerResponse["records"][number];
type LedgerRecordId = NonNullable<LedgerRecord["id"]>;

export function createBmeLedgerRecordId(input: Partial<LedgerRecordId> = {}): LedgerRecordId {
  return merge(
    {
      denom: "uakt",
      toDenom: "uact",
      source: faker.string.alphanumeric(44),
      height: { low: faker.number.int({ min: 18_000_000, max: 20_000_000 }), high: 0, unsigned: false },
      sequence: { low: faker.number.int({ min: 0, max: 100 }), high: 0, unsigned: false }
    },
    input
  );
}

export function createBmeLedgerRecord(input: Partial<LedgerRecord> & { id?: Partial<LedgerRecordId> } = {}): LedgerRecord {
  const { id, ...rest } = input;
  return merge(
    {
      id: createBmeLedgerRecordId(id),
      status: 1,
      executedRecord: undefined,
      pendingRecord: undefined
    },
    rest
  );
}

export function createBmeLedgerResponse(input: Partial<LedgerResponse> = {}): LedgerResponse {
  return merge(
    {
      records: [],
      pagination: { nextKey: {}, total: { low: 0, high: 0, unsigned: false } }
    },
    input
  );
}
