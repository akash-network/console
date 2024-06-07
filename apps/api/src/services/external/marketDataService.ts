import axios from "axios";

import { CoinGeckoCoinsResponse } from "@src/types/coingeckoCoinsResponse";

interface AktMarketData {
  price: number;
  volume: number;
  marketCap: number;
  marketCapRank: number;
  priceChange24h: number;
  priceChangePercentage24: number;
}

export async function getMarketData(): Promise<AktMarketData> {
  const endpointUrl = "https://api.coingecko.com/api/v3/coins/akash-network";
  // TODO USDC https://api.coingecko.com/api/v3/coins/usd-coin
  console.log("Fetching latest market data from " + endpointUrl);
  const response = await axios.get<CoinGeckoCoinsResponse>(endpointUrl);

  return {
    price: response.data.market_data.current_price.usd,
    volume: response.data.market_data.total_volume.usd,
    marketCap: response.data.market_data.market_cap.usd,
    marketCapRank: response.data.market_cap_rank,
    priceChange24h: response.data.market_data.price_change_24h,
    priceChangePercentage24: response.data.market_data.price_change_percentage_24h
  };
}
