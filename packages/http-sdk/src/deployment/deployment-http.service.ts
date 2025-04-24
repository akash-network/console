import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";
import { loadWithPagination } from "../utils/pagination.utils";

export type DeploymentInfo = {
  deployment: {
    deployment_id: {
      owner: string;
      dseq: string;
    };
    state: string;
    version: string;
    created_at: string;
  };
  groups: {
    group_id: {
      owner: string;
      dseq: string;
      gseq: number;
    };
    state: string;
    group_spec: {
      name: string;
      requirements: {
        signed_by: {
          all_of: string[];
          any_of: string[];
        };
        attributes: { key: string; value: string }[];
      };
      resources: {
        resource: {
          id: number;
          cpu: {
            units: {
              val: string;
            };
            attributes: { key: string; value: string }[];
          };
          memory: {
            quantity: {
              val: string;
            };
            attributes: { key: string; value: string }[];
          };
          storage: [
            {
              name: string;
              quantity: {
                val: string;
              };
              attributes: { key: string; value: string }[];
            },
            {
              name: string;
              quantity: {
                val: string;
              };
              attributes: { key: string; value: string }[];
            }
          ];
          gpu: {
            units: {
              val: string;
            };
            attributes: { key: string; value: string }[];
          };
          endpoints: { kind: string; sequence_number: number }[];
        };
        count: number;
        price: {
          denom: string;
          amount: string;
        };
      }[];
    };
    created_at: string;
  }[];
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

type RestAkashDeploymentInfoResponse =
  | {
      code: number;
      message: string;
      details: string[];
    }
  | DeploymentInfo;

type DeploymentListResponse = {
  deployments: DeploymentInfo[];
  pagination: {
    next_key: string | null;
    total: string;
  };
};

type DeploymentListParams = {
  owner: string;
  state?: string;
  "pagination.limit"?: number;
  "pagination.offset"?: number;
  "pagination.key"?: string;
  "pagination.count_total"?: boolean;
  "pagination.reverse"?: boolean;
};

interface PaginationParams {
  key?: string;
  offset?: number;
  limit?: number;
  countTotal?: boolean;
  reverse?: boolean;
}

export class DeploymentHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  public async findByOwnerAndDseq(owner: string, dseq: string): Promise<RestAkashDeploymentInfoResponse> {
    return this.extractData(
      await this.get<RestAkashDeploymentInfoResponse>("/akash/deployment/v1beta3/deployments/info", {
        params: {
          "id.owner": owner,
          "id.dseq": dseq
        }
      })
    );
  }

  /**
   * Load deployments for an owner with optional pagination
   * @param owner Owner address
   * @param state Optional state filter
   * @param pagination Optional pagination parameters
   * @returns Paginated response with deployments
   */
  public async loadAllDeployments(owner: string, state?: string, pagination?: PaginationParams): Promise<DeploymentListResponse> {
    const baseUrl = this.getUri({
      url: `/akash/deployment/v1beta3/deployments/list?filters.owner=${owner}${state ? `&filters.state=${state}` : ""}`
    });
    const defaultLimit = 1000;

    if (!pagination) {
      const allDeployments = await loadWithPagination<DeploymentInfo>(baseUrl, "deployments", defaultLimit, this);
      return {
        deployments: allDeployments,
        pagination: {
          next_key: null,
          total: allDeployments.length.toString()
        }
      };
    }

    const params: DeploymentListParams = {
      owner,
      "pagination.limit": pagination.limit || defaultLimit,
      "pagination.offset": pagination.offset,
      "pagination.key": pagination.key,
      "pagination.count_total": pagination.countTotal,
      "pagination.reverse": pagination.reverse
    };

    if (state) {
      params.state = state;
    }

    return this.extractData(
      await this.get<DeploymentListResponse>("/akash/deployment/v1beta3/deployments/list", {
        params
      })
    );
  }
}
