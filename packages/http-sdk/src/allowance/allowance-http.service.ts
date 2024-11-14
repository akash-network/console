import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";

type Denom =
  | "uakt"
  | "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1"
  | "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84";

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

interface DeploymentAllowance {
  granter: string;
  grantee: string;
  authorization: {
    "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization";
    spend_limit: SpendLimit;
    expiration: string;
  };
}

interface FeeAllowanceResponse {
  allowances: FeeAllowance[];
}

interface DeploymentAllowanceResponse {
  grants: DeploymentAllowance[];
}

export class AllowanceHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async getFeeAllowancesForGrantee(address: string) {
    const allowances = this.extractData(await this.get<FeeAllowanceResponse>(`cosmos/feegrant/v1beta1/allowances/${address}`));
    return allowances.allowances;
  }

  async getDeploymentAllowancesForGrantee(address: string) {
    const allowances = this.extractData(await this.get<DeploymentAllowanceResponse>(`cosmos/authz/v1beta1/grants/grantee/${address}`));
    return allowances.grants;
  }
}
