import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";
import type { BmeLedgerFilters, BmeLedgerResponse } from "./types";

export class BmeHttpService {
  constructor(private readonly httpClient: HttpClient) {}

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
}
