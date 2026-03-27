import type { BmeLedgerRecord, BmeLedgerRecordId, BmeLedgerRecordStatus, BmeLedgerResponse } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { merge } from "lodash";

export function createBmeLedgerRecordId(input: Partial<BmeLedgerRecordId> = {}): BmeLedgerRecordId {
  return merge(
    {
      denom: "uakt",
      to_denom: "uact",
      source: faker.string.alphanumeric(44),
      height: faker.number.int({ min: 18_000_000, max: 20_000_000 }).toString(),
      sequence: faker.number.int({ min: 0, max: 100 }).toString()
    },
    input
  );
}

export function createBmeLedgerRecord(
  input: Omit<Partial<BmeLedgerRecord>, "id"> & { id?: Partial<BmeLedgerRecordId>; status?: BmeLedgerRecordStatus } = {}
): BmeLedgerRecord {
  const { id, ...rest } = input;
  return merge(
    {
      id: createBmeLedgerRecordId(id),
      status: "ledger_record_status_pending" as BmeLedgerRecordStatus,
      executed_record: null,
      pending_record: null
    },
    rest
  );
}

export function createBmeLedgerResponse(input: Partial<BmeLedgerResponse> = {}): BmeLedgerResponse {
  return merge(
    {
      records: [],
      pagination: { next_key: null, total: "0" }
    },
    input
  );
}
