import axios from "axios";

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
  console.log("Fetching latest market data from " + endpointUrl);
  const response = await axios.get(endpointUrl);

  return {
    price: parseFloat(response.data.market_data.current_price.usd),
    volume: parseInt(response.data.market_data.total_volume.usd),
    marketCap: parseInt(response.data.market_data.market_cap.usd),
    marketCapRank: response.data.market_cap_rank,
    priceChange24h: parseFloat(response.data.market_data.price_change_24h),
    priceChangePercentage24: parseFloat(response.data.market_data.price_change_percentage_24h)
  };
}
