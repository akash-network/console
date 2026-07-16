import type { HttpClient } from "../utils/httpClient";

type Attribute = {
  key: string;
  value: string;
};

export type DeploymentResource = {
  id: number;
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
    id: {
      owner: string;
      dseq: string;
      gseq: number;
      oseq: number;
      provider: string;
      bseq: number;
    };
    state: "open" | "active" | "closed";
    price: {
      denom: string;
      amount: string;
    };
    resources_offer: {
      resources: DeploymentResource;
      count: number;
    }[];
    created_at: string;
    // Present only on v2.1+ bids where the provider offers a reclamation window (AEP-82).
    // Nil when the provider offers no reclamation. REST serializes the Duration, e.g. "86400s".
    reclamation_window?: string;
  };
  escrow_account: {
    id: {
      scope: string;
      xid: string;
    };
    state: {
      owner: string;
      state: string;
      transferred: {
        denom: string;
        amount: string;
      }[];
      settled_at: string;
      funds: {
        denom: string;
        amount: string;
      }[];
      deposits: {
        owner: string;
        height: string;
        source: string;
        balance: {
          denom: string;
          amount: string;
        };
      }[];
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

export class BidHttpService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  public async list(owner: string, dseq: string): Promise<Bid[]> {
    const response = await this.#httpClient.get<RestAkashBidListResponse>(`/akash/market/v1beta5/bids/list?filters.owner=${owner}&filters.dseq=${dseq}`);

    return response.data.bids;
  }
}
