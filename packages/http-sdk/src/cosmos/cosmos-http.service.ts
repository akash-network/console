import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";

import { HttpService } from "../http/http.service";
import type {
  CosmosBankSupplyResponse,
  CosmosDistributionCommunityPoolResponse,
  CosmosDistributionParamsResponse,
  CosmosMintInflationResponse,
  CosmosStakingPoolResponse
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
}
