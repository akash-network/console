export type CoinGeckoCoinsResponse = {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number;
  market_data: {
    current_price: { usd: number };
    total_volume: { usd: number };
    market_cap: { usd: number };
    price_change_24h: number;
    price_change_percentage_24h: number;
  };
};
