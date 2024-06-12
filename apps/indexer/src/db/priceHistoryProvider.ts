import { activeChain } from "@akashnetwork/database/chainDefinitions";
import { Day } from "@akashnetwork/database/dbSchemas/base";
import { isSameDay } from "date-fns";
import fetch from "node-fetch";

interface PriceHistoryResponse {
  prices: Array<Array<number>>;
  market_caps: Array<Array<number>>;
  total_volumes: Array<Array<number>>;
}

export const syncPriceHistory = async () => {
  if (!activeChain.coinGeckoId) {
    console.log("No coin gecko id defined for this chain. Skipping price history sync.");
    return;
  }

  const endpointUrl = `https://api.coingecko.com/api/v3/coins/${activeChain.coinGeckoId}/market_chart?vs_currency=usd&days=360`;

  console.log("Fetching latest market data from " + endpointUrl);

  const response = await fetch(endpointUrl);
  const data: PriceHistoryResponse = await response.json();
  const apiPrices = data.prices.map(pDate => ({
    date: pDate[0],
    price: pDate[1]
  }));

  console.log(`There are ${apiPrices.length} prices to update.`);

  const days = await Day.findAll();

  for (const day of days) {
    const priceData = apiPrices.find(x => isSameDay(new Date(x.date), day.date));

    if (priceData && priceData.price != day.aktPrice) {
      day.aktPrice = priceData.price;
      day.aktPriceChanged = true;
      await day.save();
    }
  }
};
