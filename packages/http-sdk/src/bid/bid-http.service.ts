import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";

type Bid = {
  bid: {
    bid_id: {
      owner: string;
      dseq: string;
      gseq: number;
      oseq: number;
      provider: string;
    };
    state: "open" | "active" | "closed";
    price: {
      denom: string;
      amount: string;
    };
    created_at: string;
  };
  escrow_account: {
    id: {
      scope: string;
      xid: string;
    };
    owner: string;
    state: string;
    balance: {
      denom: string;
      amount: string;
    };
    transferred: {
      denom: string;
      amount: string;
    };
    settled_at: string;
    depositor: string;
    funds: {
      denom: string;
      amount: string;
    };
  };
};

type RestAkashBidListResponse = {
  bids: Bid[];
  pagination: {
    next_key: string | null;
    total: string;
  };
};

export class BidHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  public async list(owner: string, dseq: string): Promise<Bid[]> {
    const response = this.extractData(await this.get<RestAkashBidListResponse>(`/akash/market/v1beta4/bids/list?filters.owner=${owner}&filters.dseq=${dseq}`));

    return response.bids;
  }
}
