import type { HttpClient } from "../utils/httpClient";
import type { CoinGeckoCoinsResponse } from "./types";

export class CoinGeckoHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  async getMarketData(coin: string): Promise<CoinGeckoCoinsResponse> {
    const response = await this.httpClient.get<CoinGeckoCoinsResponse>(`/api/v3/coins/${coin}`);
    return response.data;
  }
}
