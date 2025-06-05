import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";

import { HttpService } from "../http/http.service";
import type { CoinGeckoCoinsResponse } from "./types";

const RETRY_COUNT = 3;
const RETRY_DELAY_MILLISECONDS = 100;

export class CoinGeckoHttpService extends HttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);

    axiosRetry(this as unknown as AxiosInstance, {
      retries: RETRY_COUNT,
      retryDelay: retryCount => Math.pow(2, retryCount) * RETRY_DELAY_MILLISECONDS,
      retryCondition: (error: AxiosError) => axiosRetry.isNetworkError(error) || (error.response?.status !== undefined && error.response.status >= 500)
    });
  }

  async getMarketData(coin: string) {
    return this.extractData(await this.get<CoinGeckoCoinsResponse>(`/api/v3/coins/${coin}`));
  }
}
