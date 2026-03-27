export type BmeLedgerRecordStatus = "ledger_record_status_pending" | "ledger_record_status_executed" | "ledger_record_status_canceled";

export interface BmeCoinWithPrice {
  coin: {
    denom: string;
    amount: string;
  };
  price: string;
}

export interface BmeLedgerRecordId {
  denom: string;
  to_denom: string;
  source: string;
  height: string;
  sequence: string;
}

export interface BmeLedgerExecutedRecord {
  burned_from: string;
  minted_to: string;
  burner: string;
  minter: string;
  burned: BmeCoinWithPrice | null;
  minted: BmeCoinWithPrice | null;
  remint_credit_issued: BmeCoinWithPrice | null;
  remint_credit_accrued: BmeCoinWithPrice | null;
}

export interface BmeLedgerPendingRecord {
  owner: string;
  to: string;
  coins_to_burn: {
    denom: string;
    amount: string;
  };
  denom_to_mint: string;
}

export interface BmeLedgerRecord {
  id: BmeLedgerRecordId;
  status: BmeLedgerRecordStatus;
  executed_record: BmeLedgerExecutedRecord | null;
  pending_record: BmeLedgerPendingRecord | null;
}

export interface BmeLedgerResponse {
  records: BmeLedgerRecord[];
  pagination: {
    next_key: string | null;
    total: string;
  };
}

export interface BmeParamsResponse {
  params: {
    min_mint: Array<{ denom: string; amount: string }>;
  };
}

export interface BmeLedgerFilters {
  source?: string;
  denom?: string;
  to_denom?: string;
  status?: BmeLedgerRecordStatus;
}
