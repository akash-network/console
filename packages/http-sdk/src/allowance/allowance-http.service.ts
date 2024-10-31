import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";
import type { Denom } from "../types/denom.type";

type SpendLimit = {
  denom: Denom;
  amount: string;
};

interface FeeAllowance {
  granter: string;
  grantee: string;
  allowance: {
    "@type": "/cosmos.feegrant.v1beta1.BasicAllowance";
    spend_limit: SpendLimit[];
    expiration: string;
  };
}

export interface DeploymentAllowance {
  granter: string;
  grantee: string;
  authorization: {
    "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization";
    spend_limit: SpendLimit;
    expiration: string;
  };
}

interface FeeAllowanceListResponse {
  allowances: FeeAllowance[];
}

interface FeeAllowanceResponse {
  allowance: FeeAllowance;
}

interface DeploymentAllowanceResponse {
  grants: DeploymentAllowance[];
  pagination: {
    next_key: string | null;
  };
}

export class AllowanceHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async getFeeAllowancesForGrantee(address: string) {
    const allowances = this.extractData(await this.get<FeeAllowanceListResponse>(`cosmos/feegrant/v1beta1/allowances/${address}`));
    return allowances.allowances;
  }

  async getFeeAllowanceForGranterAndGrantee(granter: string, grantee: string) {
    const allowances = this.extractData(await this.get<FeeAllowanceResponse>(`cosmos/feegrant/v1beta1/allowance/${granter}/${grantee}`));
    return allowances.allowance;
  }

  async getDeploymentAllowancesForGrantee(address: string) {
    const allowances = this.extractData(await this.get<DeploymentAllowanceResponse>(`cosmos/authz/v1beta1/grants/grantee/${address}`));
    return allowances.grants;
  }

  async paginateDeploymentGrantsForGrantee(address: string, cb: (page: DeploymentAllowanceResponse["grants"]) => Promise<void>) {
    let nextPageKey: string | null;

    do {
      const response = this.extractData(
        await this.get<DeploymentAllowanceResponse>(
          `cosmos/authz/v1beta1/grants/grantee/${address}`,
          nextPageKey && {
            params: { "pagination.key": nextPageKey }
          }
        )
      );
      nextPageKey = response.pagination.next_key;

      await cb(response.grants);
    } while (nextPageKey);
  }
}
