import { AxiosRequestConfig } from "axios";
import { isFuture } from "date-fns";

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

export interface ExactDepositDeploymentGrant {
  authorization: {
    "@type": "/akash.deployment.v1beta3.DepositDeploymentAuthorization";
    spend_limit: SpendLimit;
  };
  expiration: string;
}

export interface DepositDeploymentGrant extends ExactDepositDeploymentGrant {
  granter: string;
  grantee: string;
}

interface FeeAllowanceListResponse {
  allowances: FeeAllowance[];
}

interface FeeAllowanceResponse {
  allowance: FeeAllowance;
}

interface DepositDeploymentGrantResponse<T extends ExactDepositDeploymentGrant = DepositDeploymentGrant> {
  grants: T[];
  pagination: {
    next_key: string | null;
  };
}

export class AuthzHttpService extends HttpService {
  private readonly DEPOSIT_DEPLOYMENT_GRANT_TYPE: ExactDepositDeploymentGrant['authorization']['@type'] = "/akash.deployment.v1beta3.DepositDeploymentAuthorization";

  private readonly FEE_ALLOWANCE_TYPE: FeeAllowance['allowance']['@type'] = "/cosmos.feegrant.v1beta1.BasicAllowance";

  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  async getFeeAllowancesForGrantee(address: string) {
    const allowances = this.extractData(await this.get<FeeAllowanceListResponse>(`cosmos/feegrant/v1beta1/allowances/${address}`));
    return allowances.allowances;
  }

  async getValidFeeAllowancesForGrantee(address: string) {
    const allowances = await this.getFeeAllowancesForGrantee(address);
    return allowances.filter(allowance => this.isValidFeeAllowance(allowance));
  }

  async getFeeAllowanceForGranterAndGrantee(granter: string, grantee: string): Promise<FeeAllowance | undefined> {
    try {
      const response = this.extractData(await this.get<FeeAllowanceResponse>(`cosmos/feegrant/v1beta1/allowance/${granter}/${grantee}`));
      return this.isValidFeeAllowance(response.allowance) ? response.allowance : undefined;
    } catch (error) {
      if (error.response.data.message.includes("fee-grant not found")) {
        return undefined;
      }

      throw error;
    }
  }

  async getDepositDeploymentGrantsForGranterAndGrantee(granter: string, grantee: string): Promise<ExactDepositDeploymentGrant | undefined> {
    const response = this.extractData(
      await this.get<DepositDeploymentGrantResponse<ExactDepositDeploymentGrant>>("cosmos/authz/v1beta1/grants", {
        params: {
          grantee: grantee,
          granter: granter
        }
      })
    );
    return response.grants.find(grant => this.isValidDepositDeploymentGrant(grant));
  }

  async hasFeeAllowance(granter: string, grantee: string) {
    const feeAllowances = await this.getFeeAllowancesForGrantee(grantee);
    return feeAllowances.some(allowance => allowance.granter === granter);
  }

  async hasValidFeeAllowance(granter: string, grantee: string) {
    const feeAllowances = await this.getValidFeeAllowancesForGrantee(grantee);
    return feeAllowances.some(allowance => allowance.granter === granter);
  }

  async hasValidDepositDeploymentGrant(granter: string, grantee: string) {
    return !!(await this.getDepositDeploymentGrantsForGranterAndGrantee(granter, grantee))
  }

  async paginateDepositDeploymentGrants(
    options: ({ granter: string } | { grantee: string }) & { limit: number },
    cb: (page: DepositDeploymentGrantResponse["grants"]) => Promise<void>
  ): Promise<void> {
    let nextPageKey: string | null = null;
    const side = "granter" in options ? "granter" : "grantee";
    const address = "granter" in options ? options.granter : options.grantee;

    do {
      const response = this.extractData(
        await this.get<DepositDeploymentGrantResponse>(
          `cosmos/authz/v1beta1/grants/${side}/${address}`,
            {
                params: { "pagination.key": nextPageKey, "pagination.limit": options.limit }
              }
        )
      );
      nextPageKey = response.pagination.next_key;

      await cb(response.grants.filter(grant => this.isValidDepositDeploymentGrant(grant)));
    } while (nextPageKey);
  }

  async getAllDepositDeploymentGrants(
    options: ({ granter: string } | { grantee: string }) & { limit: number },
  ): Promise<DepositDeploymentGrant[]> {
    const result: DepositDeploymentGrant[] = [];

    await this.paginateDepositDeploymentGrants(options, async (page) => {
      result.push(...page);
    })

    return result;
  }

  private isValidFeeAllowance({ allowance }: FeeAllowance) {
    return allowance["@type"] === this.FEE_ALLOWANCE_TYPE && (!allowance.expiration || isFuture(new Date(allowance.expiration)));
  }

  private isValidDepositDeploymentGrant({ authorization, expiration }: ExactDepositDeploymentGrant) {
    return authorization["@type"] === this.DEPOSIT_DEPLOYMENT_GRANT_TYPE && (!expiration || isFuture(new Date(expiration)));
  }
}
