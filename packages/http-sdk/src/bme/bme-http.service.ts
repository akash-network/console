import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";
import type { BmeLedgerFilters, BmeLedgerResponse, BmeParamsResponse } from "./types";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 24;

export class BmeHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  async getParams(): Promise<BmeParamsResponse> {
    return extractData(await this.httpClient.get<BmeParamsResponse>("/akash/bme/v1/params"));
  }

  async getLedgerRecords(filters?: BmeLedgerFilters, pagination?: { limit?: number; offset?: number }): Promise<BmeLedgerResponse> {
    const params = new URLSearchParams();

    if (filters?.source) params.set("filters.source", filters.source);
    if (filters?.denom) params.set("filters.denom", filters.denom);
    if (filters?.to_denom) params.set("filters.to_denom", filters.to_denom);
    if (filters?.status) params.set("filters.status", filters.status);

    if (pagination?.limit) params.set("pagination.limit", pagination.limit.toString());
    if (pagination?.offset !== undefined) params.set("pagination.offset", pagination.offset.toString());
    params.set("pagination.count_total", "true");

    const query = params.toString();
    return extractData(await this.httpClient.get<BmeLedgerResponse>(`/akash/bme/v1/ledger${query ? `?${query}` : ""}`));
  }

  async waitForLedgerRecordsSettlement(address: string, options?: { pollIntervalMs?: number; maxAttempts?: number; signal?: AbortSignal }): Promise<boolean> {
    const pollInterval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (options?.signal?.aborted) return false;

      const { records } = await this.getLedgerRecords({
        source: address,
        status: "ledger_record_status_pending"
      });

      if (records.length === 0) return true;

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return false;
  }
}
