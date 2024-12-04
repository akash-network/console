import { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";
import type { Denom } from "../types/denom.type";

export interface SpendLimit {
  denom: Denom;
  amount: string;
}

export interface FeeAllowance {
  granter: string;
  grantee: string;
  allowance: {
    "@type": "/cosmos.feegrant.v1beta1.BasicAllowance";
    spend_limit: SpendLimit[];
    expiration: string;
  };
}

export interface ExactDeploymentAllowance {
  authorization: {
    "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization";
    spend_limit: SpendLimit;
  };
  expiration: string;
}

export interface DeploymentAllowance extends ExactDeploymentAllowance {
  granter: string;
  grantee: string;
}

interface FeeAllowanceListResponse {
  allowances: FeeAllowance[];
}

interface FeeAllowanceResponse {
  allowance: FeeAllowance;
}

interface DeploymentAllowanceResponse<T extends ExactDeploymentAllowance = DeploymentAllowance> {
  grants: T[];
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
    return allowances.allowances.filter(allowance => allowance.allowance["@type"] === "/cosmos.feegrant.v1beta1.BasicAllowance");
  }

  async getFeeAllowanceForGranterAndGrantee(granter: string, grantee: string) {
    try {
      const allowances = this.extractData(await this.get<FeeAllowanceResponse>(`cosmos/feegrant/v1beta1/allowance/${granter}/${grantee}`));
      return allowances.allowance.allowance["@type"] === "/cosmos.feegrant.v1beta1.BasicAllowance" ? allowances.allowance : undefined;
    } catch (error) {
      if (error.response.data.message.includes("fee-grant not found")) {
        return undefined;
      }

      throw error;
    }
  }

  async getDeploymentAllowancesForGrantee(address: string) {
    const allowances = this.extractData(await this.get<DeploymentAllowanceResponse>(`cosmos/authz/v1beta1/grants/grantee/${address}`));
    return allowances.grants.filter(grant => grant.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization");
  }

  async getDeploymentGrantsForGranterAndGrantee(granter: string, grantee: string) {
    const allowances = this.extractData(
      await this.get<DeploymentAllowanceResponse<ExactDeploymentAllowance>>("cosmos/authz/v1beta1/grants", {
        params: {
          grantee: grantee,
          granter: granter
        }
      })
    );
    return allowances.grants.find(grant => grant.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization");
  }

  async hasFeeAllowance(granter: string, grantee: string) {
    const feeAllowances = await this.getFeeAllowancesForGrantee(grantee);
    return feeAllowances.some(allowance => allowance.granter === granter);
  }

  async hasDeploymentGrant(granter: string, grantee: string) {
    const feeAllowances = await this.getDeploymentAllowancesForGrantee(grantee);
    return feeAllowances.some(allowance => allowance.granter === granter);
  }

  async paginateDeploymentGrants(
    options: ({ granter: string } | { grantee: string }) & { limit: number },
    cb: (page: DeploymentAllowanceResponse["grants"]) => Promise<void>
  ) {
    let nextPageKey: string | null = null;
    const side = "granter" in options ? "granter" : "grantee";
    const address = "granter" in options ? options.granter : options.grantee;

    do {
      const response = this.extractData(
        await this.get<DeploymentAllowanceResponse>(
          `cosmos/authz/v1beta1/grants/${side}/${address}`,
          nextPageKey
            ? {
                params: { "pagination.key": nextPageKey, "pagination.limit": options.limit }
              }
            : undefined
        )
      );
      nextPageKey = response.pagination.next_key;

      await cb(response.grants.filter(grant => grant.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization"));
    } while (nextPageKey);
  }
}
