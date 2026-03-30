import { faker } from "@faker-js/faker";
import { merge } from "lodash";

export interface DenomExchangeRate {
  price: number;
  volume: number;
  marketCap: number;
  marketCapRank: number;
  priceChange24h: number;
  priceChangePercentage24: number;
}

export function createDenomExchangeRate(input: Partial<DenomExchangeRate> = {}): DenomExchangeRate {
  const price = input.price ?? faker.number.float({ min: 0.1, max: 10, fractionDigits: 6 });

  return merge(
    {
      price,
      volume: 0,
      marketCap: 0,
      marketCapRank: 0,
      priceChange24h: 0,
      priceChangePercentage24: 0
    },
    input
  );
}
