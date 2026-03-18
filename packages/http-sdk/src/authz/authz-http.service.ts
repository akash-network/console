import { isFuture } from "date-fns";

import { extractData } from "../http/http.service";
import type { Denom } from "../types/denom.type";
import type { HttpClient } from "../utils/httpClient";
import { isHttpError } from "../utils/isHttpError";

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

export interface LegacyExactDepositDeploymentGrant {
  authorization: {
    "@type": "/akash.escrow.v1.DepositAuthorization";
    spend_limits?: SpendLimit[];
    spend_limit: SpendLimit;
  };
  expiration: string;
}

export interface ExactDepositDeploymentGrant {
  authorization: {
    "@type": "/akash.escrow.v1.DepositAuthorization";
    spend_limits: SpendLimit[];
  };
  expiration: string;
}

export interface LegacyDepositDeploymentGrant extends LegacyExactDepositDeploymentGrant {
  granter: string;
  grantee: string;
}

export interface DepositDeploymentGrant extends ExactDepositDeploymentGrant {
  granter: string;
  grantee: string;
}

interface FeeAllowanceListResponse {
  allowances: FeeAllowance[];
  pagination?: {
    next_key: string | null;
    total: string;
  };
}

interface FeeAllowanceResponse {
  allowance: FeeAllowance;
}

interface DepositDeploymentGrantResponse<T extends LegacyExactDepositDeploymentGrant | ExactDepositDeploymentGrant = LegacyDepositDeploymentGrant> {
  grants: T[];
  pagination?: {
    next_key: string | null;
    total: string;
  };
}

export class AuthzHttpService {
  private readonly DEPOSIT_DEPLOYMENT_GRANT_TYPE: LegacyExactDepositDeploymentGrant["authorization"]["@type"] = "/akash.escrow.v1.DepositAuthorization";

  constructor(private readonly httpClient: HttpClient) {}

  async getFeeAllowancesForGrantee(address: string) {
    const allowances = extractData(await this.httpClient.get<FeeAllowanceListResponse>(`cosmos/feegrant/v1beta1/allowances/${address}`));
    return allowances.allowances;
  }

  async getValidFeeAllowancesForGrantee(address: string) {
    const allowances = await this.getFeeAllowancesForGrantee(address);
    return allowances.filter(allowance => this.isValidFeeAllowance(allowance));
  }

  async getPaginatedFeeAllowancesForGranter(address: string, limit: number, offset: number) {
    const allowances = extractData(
      await this.httpClient.get<FeeAllowanceListResponse>(`cosmos/feegrant/v1beta1/issued/${address}`, {
        params: {
          "pagination.limit": limit,
          "pagination.offset": offset,
          "pagination.count_total": true
        }
      })
    );

    return {
      ...allowances,
      pagination: {
        next_key: allowances.pagination?.next_key ?? null,
        total: parseInt(allowances.pagination?.total || "0")
      }
    };
  }

  async getFeeAllowanceForGranterAndGrantee(granter: string, grantee: string): Promise<FeeAllowance | undefined> {
    try {
      const response = extractData(await this.httpClient.get<FeeAllowanceResponse>(`cosmos/feegrant/v1beta1/allowance/${granter}/${grantee}`));
      return this.isValidFeeAllowance(response.allowance) ? response.allowance : undefined;
    } catch (error) {
      if (isHttpError(error) && error.response?.data.message?.includes("fee-grant not found")) {
        return undefined;
      }

      throw error;
    }
  }

  async getDepositDeploymentGrantsForGranterAndGrantee(granter: string, grantee: string): Promise<ExactDepositDeploymentGrant | undefined> {
    const response = extractData(
      await this.httpClient.get<DepositDeploymentGrantResponse<LegacyExactDepositDeploymentGrant>>("cosmos/authz/v1beta1/grants", {
        params: {
          grantee: grantee,
          granter: granter
        }
      })
    );
    const grant = response.grants.find(grant => this.isDepositDeploymentGrant(grant));
    return migrateLegacyDepositDeploymentGrant(grant);
  }

  async getValidDepositDeploymentGrantsForGranterAndGrantee(granter: string, grantee: string): Promise<ExactDepositDeploymentGrant | undefined> {
    const response = extractData(
      await this.httpClient.get<DepositDeploymentGrantResponse<LegacyExactDepositDeploymentGrant>>("cosmos/authz/v1beta1/grants", {
        params: {
          grantee: grantee,
          granter: granter
        }
      })
    );
    return migrateLegacyDepositDeploymentGrant(response.grants.find(grant => this.isValidDepositDeploymentGrant(grant)));
  }

  async hasFeeAllowance(granter: string, grantee: string) {
    const feeAllowances = await this.getFeeAllowancesForGrantee(grantee);
    return feeAllowances.some(allowance => allowance.granter === granter);
  }

  async hasValidFeeAllowance(granter: string, grantee: string) {
    const feeAllowances = await this.getValidFeeAllowancesForGrantee(grantee);
    return feeAllowances.some(allowance => allowance.granter === granter);
  }

  async hasDepositDeploymentGrant(granter: string, grantee: string) {
    return !!(await this.getDepositDeploymentGrantsForGranterAndGrantee(granter, grantee));
  }

  async hasValidDepositDeploymentGrant(granter: string, grantee: string) {
    return !!(await this.getValidDepositDeploymentGrantsForGranterAndGrantee(granter, grantee));
  }

  async paginateDepositDeploymentGrants<T extends ExactDepositDeploymentGrant>(
    options: ({ granter: string } | { grantee: string }) & { limit: number },
    cb: (page: T[]) => Promise<void>
  ): Promise<void> {
    let nextPageKey: unknown;
    const side = "granter" in options ? "granter" : "grantee";
    const address = "granter" in options ? options.granter : options.grantee;

    do {
      const response = extractData(
        await this.httpClient.get<DepositDeploymentGrantResponse>(`cosmos/authz/v1beta1/grants/${side}/${address}`, {
          params: { "pagination.key": nextPageKey, "pagination.limit": options.limit }
        })
      );
      nextPageKey = response.pagination?.next_key;

      await cb(response.grants.filter(grant => this.isValidDepositDeploymentGrant(grant)).map(grant => migrateLegacyDepositDeploymentGrant(grant)));
    } while (nextPageKey);
  }

  async getAllDepositDeploymentGrants(options: ({ granter: string } | { grantee: string }) & { limit: number }): Promise<DepositDeploymentGrant[]> {
    const result: DepositDeploymentGrant[] = [];

    await this.paginateDepositDeploymentGrants<DepositDeploymentGrant>(options, async page => {
      result.push(...page);
    });

    return result;
  }

  async getPaginatedDepositDeploymentGrants(options: ({ granter: string } | { grantee: string }) & { limit: number; offset: number }) {
    const side = "granter" in options ? "granter" : "grantee";
    const address = "granter" in options ? options.granter : options.grantee;
    const limit = options.limit;
    const offset = options.offset;

    const response = extractData(
      await this.httpClient.get<DepositDeploymentGrantResponse>(`cosmos/authz/v1beta1/grants/${side}/${address}`, {
        params: {
          "pagination.limit": limit,
          "pagination.offset": offset,
          "pagination.count_total": true
        }
      })
    );

    return {
      ...response,
      grants: response.grants.map(g => migrateLegacyDepositDeploymentGrant<LegacyDepositDeploymentGrant, DepositDeploymentGrant>(g)),
      pagination: {
        next_key: response.pagination?.next_key ?? null,
        total: parseInt(response.pagination?.total || "0", 10)
      }
    };
  }

  private isValidFeeAllowance(allowance: FeeAllowance) {
    return !allowance.allowance.expiration || isFuture(new Date(allowance.allowance.expiration));
  }

  private isValidDepositDeploymentGrant(grant: LegacyExactDepositDeploymentGrant) {
    return this.isDepositDeploymentGrant(grant) && (!grant.expiration || isFuture(new Date(grant.expiration)));
  }

  private isDepositDeploymentGrant({ authorization }: LegacyExactDepositDeploymentGrant) {
    return authorization["@type"] === this.DEPOSIT_DEPLOYMENT_GRANT_TYPE;
  }
}

type GrantOrFalsy<T extends LegacyExactDepositDeploymentGrant | null | undefined, U extends ExactDepositDeploymentGrant> = T extends null | undefined ? T : U;
function migrateLegacyDepositDeploymentGrant<
  T extends LegacyExactDepositDeploymentGrant | null | undefined,
  U extends ExactDepositDeploymentGrant = ExactDepositDeploymentGrant
>(grant: T): GrantOrFalsy<T, U> {
  if (!grant) return grant as GrantOrFalsy<T, U>;

  const spendLimits = grant.authorization.spend_limits ?? [];

  if (grant.authorization.spend_limit && grant.authorization.spend_limit.amount !== "0") {
    spendLimits.push(grant.authorization.spend_limit);
  }
  return {
    ...grant,
    authorization: {
      "@type": "/akash.escrow.v1.DepositAuthorization",
      spend_limits: spendLimits
    }
  } as GrantOrFalsy<T, U>;
}
