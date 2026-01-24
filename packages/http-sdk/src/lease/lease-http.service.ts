import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";

export interface RpcLease {
  lease: {
    id: {
      owner: string;
      dseq: string;
      gseq: number;
      oseq: number;
      provider: string;
      bseq: number;
    };
    state: string;
    price: {
      denom: string;
      amount: string;
    };
    created_at: string;
    closed_on: string;
    reason?: string;
  };
  escrow_payment: {
    id: {
      aid: {
        scope: string;
        xid: string;
      };
      xid: string;
    };
    state: {
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
      unsettled: {
        denom: string;
        amount: string;
      };
      withdrawn: {
        denom: string;
        amount: string;
      };
    };
  };
}

export type RestAkashLeaseListResponse = {
  leases: RpcLease[];
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
        },
        timeout: 10000
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
