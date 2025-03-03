import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";

type RestAkashLeaseListResponse = {
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
    next_key: string;
    total: string;
  };
};

export class LeaseHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  public async listByOwnerAndDseq(owner: string, dseq: string): Promise<RestAkashLeaseListResponse> {
    return this.extractData(await this.get<RestAkashLeaseListResponse>('/akash/market/v1beta4/leases/list', {
      params: {
        "filters.owner": owner,
        "filters.dseq": dseq,
      },
    }));
  }
}
