import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";

export type RestAkashLeaseListResponse = {
  leases: {
    lease: {
      lease_id: {
        owner: string;
        dseq: string;
        gseq: number;
        oseq: number;
        provider: string;
      };
      state: string;
      price: {
        denom: string;
        amount: string;
      };
      created_at: string;
      closed_on: string;
    };
    escrow_payment: {
      account_id: {
        scope: string;
        xid: string;
      };
      payment_id: string;
      owner: string;
      state: string;
      rate: {
        denom: string;
        amount: string;
      };
      balance: {
        denom: string;
        amount: string;
      };
      withdrawn: {
        denom: string;
        amount: string;
      };
    };
  }[];
  pagination: {
    next_key: string | null;
    total: string;
  };
};

export type LeaseListParams = {
  owner: string;
  dseq?: string;
  state?: "active" | "insufficient_funds" | "closed";
  pagination?: {
    limit?: number;
    key?: string;
  };
};

export class LeaseHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  public async list({ owner, dseq, state, pagination }: LeaseListParams): Promise<RestAkashLeaseListResponse> {
    return extractData(
      await this.httpClient.get<RestAkashLeaseListResponse>("/akash/market/v1beta5/leases/list", {
        params: {
          "filters.owner": owner,
          "filters.dseq": dseq,
          "filters.state": state,
          "pagination.limit": pagination?.limit,
          "pagination.key": pagination?.key
        }
      })
    );
  }

  async hasLeases(address: string): Promise<boolean> {
    const response = await this.list({
      owner: address,
      pagination: { limit: 1 }
    });
    return response.leases.length > 0 || !!response.pagination.next_key || Number(response.pagination.total) > 0;
  }
}
