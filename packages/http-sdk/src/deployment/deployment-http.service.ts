import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";

type DeploymentInfo = {
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

export class DeploymentHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  public async findByOwnerAndDseq(owner: string, dseq: string): Promise<RestAkashDeploymentInfoResponse> {
    return this.extractData(await this.get<RestAkashDeploymentInfoResponse>('/akash/deployment/v1beta3/deployments/info', {
      params: {
        "id.owner": owner,
        "id.dseq": dseq,
      },
    }));
  }
}
