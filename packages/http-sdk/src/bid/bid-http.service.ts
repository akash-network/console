import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";

type Attribute = {
  key: string;
  value: string;
};

export type DeploymentResource_V3 = {
  cpu: {
    units: {
      val: string;
    };
    attributes: Attribute[];
  };
  gpu: {
    units: {
      val: string;
    };
    attributes: Attribute[];
  };
  memory: {
    quantity: {
      val: string;
    };
    attributes: Attribute[];
  };
  storage: {
    name: string;
    quantity: {
      val: string;
    };
    attributes: Attribute[];
  }[];
  endpoints: {
    kind: string;
    sequence_number: number;
  }[];
};

export type Bid = {
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
    resources_offer: {
      resources: DeploymentResource_V3;
      count: number;
    }[];
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
