import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";

import { HttpService } from "../http/http.service";
import type {
  CosmosBankSupplyResponse,
  CosmosDistributionCommunityPoolResponse,
  CosmosDistributionParamsResponse,
  CosmosDistributionValidatorsCommissionResponse,
  CosmosMintInflationResponse,
  CosmosStakingPoolResponse,
  RestCosmosBankBalancesResponse,
  RestCosmosDistributionDelegatorsRewardsResponse,
  RestCosmosStakingDelegationsResponse,
  RestCosmosStakingDelegatorsRedelegationsResponse,
  RestCosmosStakingValidatorListResponse,
  RestCosmosStakingValidatorResponse
} from "./types";

const RETRY_COUNT = 3;
const RETRY_DELAY_MILLISECONDS = 100;

export class CosmosHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);

    axiosRetry(this as unknown as AxiosInstance, {
      retries: RETRY_COUNT,
      retryDelay: retryCount => Math.pow(2, retryCount) * RETRY_DELAY_MILLISECONDS,
      retryCondition: (error: AxiosError) => axiosRetry.isNetworkError(error) || (error.response?.status !== undefined && error.response.status >= 500)
    });
  }

  async getStakingPool() {
    const response = this.extractData(await this.get<CosmosStakingPoolResponse>(`/cosmos/staking/v1beta1/pool`));

    return response.pool;
  }

  async getBankSupply(): Promise<CosmosBankSupplyResponse["supply"]> {
    const response = this.extractData(await this.get<CosmosBankSupplyResponse>(`/cosmos/bank/v1beta1/supply?pagination.limit=1000`));

    return response.supply;
  }

  async getCommunityPool(): Promise<CosmosDistributionCommunityPoolResponse["pool"]> {
    const response = this.extractData(await this.get<CosmosDistributionCommunityPoolResponse>(`/cosmos/distribution/v1beta1/community_pool`));

    return response.pool;
  }

  async getInflation(): Promise<number> {
    const response = this.extractData(await this.get<CosmosMintInflationResponse>(`/cosmos/mint/v1beta1/inflation`));

    return parseFloat(response.inflation || "0");
  }

  async getDistributionParams(): Promise<CosmosDistributionParamsResponse["params"]> {
    const response = this.extractData(await this.get<CosmosDistributionParamsResponse>(`/cosmos/distribution/v1beta1/params`));

    return response.params;
  }

  async getValidatorList(): Promise<RestCosmosStakingValidatorListResponse> {
    return this.extractData(
      await this.get<RestCosmosStakingValidatorListResponse>(`/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=1000`)
    );
  }

  async getValidatorByAddress(address: string): Promise<RestCosmosStakingValidatorResponse> {
    return this.extractData(await this.get<RestCosmosStakingValidatorResponse>(`/cosmos/staking/v1beta1/validators/${address}`));
  }

  async getBankBalancesByAddress(address: string): Promise<RestCosmosBankBalancesResponse> {
    return this.extractData(await this.get<RestCosmosBankBalancesResponse>(`/cosmos/bank/v1beta1/balances/${address}?pagination.limit=1000`));
  }

  async getStakingDelegationsByAddress(address: string): Promise<RestCosmosStakingDelegationsResponse> {
    return this.extractData(await this.get<RestCosmosStakingDelegationsResponse>(`/cosmos/staking/v1beta1/delegations/${address}?pagination.limit=1000`));
  }

  async getDistributionDelegatorsRewardsByAddress(address: string): Promise<RestCosmosDistributionDelegatorsRewardsResponse> {
    return this.extractData(await this.get<RestCosmosDistributionDelegatorsRewardsResponse>(`/cosmos/distribution/v1beta1/delegators/${address}/rewards`));
  }

  async getStakingDelegatorsRedelegationsByAddress(address: string): Promise<RestCosmosStakingDelegatorsRedelegationsResponse> {
    return this.extractData(
      await this.get<RestCosmosStakingDelegatorsRedelegationsResponse>(`/cosmos/staking/v1beta1/delegators/${address}/redelegations?pagination.limit=1000`)
    );
  }

  async getDistributionValidatorsCommissionByAddress(address: string): Promise<CosmosDistributionValidatorsCommissionResponse> {
    return this.extractData(await this.get<CosmosDistributionValidatorsCommissionResponse>(`/cosmos/distribution/v1beta1/validators/${address}/commission`));
  }
}
