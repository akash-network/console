import type { AxiosError, AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

import { HttpService } from "../http/http.service";
import type { CoinGeckoCoinsResponse } from "./types";

const RETRY_COUNT = 3;
const RETRY_DELAY_MILLISECONDS = 100;

export class CoinGeckoHttpService extends HttpService {
  constructor(axios: AxiosInstance) {
    super(axios);

    axiosRetry(axios, {
      retries: RETRY_COUNT,
      retryDelay: retryCount => Math.pow(2, retryCount) * RETRY_DELAY_MILLISECONDS,
      retryCondition: (error: AxiosError) => axiosRetry.isNetworkError(error) || (error.response?.status !== undefined && error.response.status >= 500)
    });
  }

  async getMarketData(coin: string) {
    return this.extractData(await this.get<CoinGeckoCoinsResponse>(`/api/v3/coins/${coin}`));
  }
}
