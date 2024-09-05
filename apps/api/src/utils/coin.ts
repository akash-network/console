import { asset_lists } from "@chain-registry/assets";
import * as Sentry from "@sentry/node";
import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";

export function coinToAsset(coin: Coin) {
  try {
    if (coin.denom === "uakt") {
      return {
        symbol: "AKT",
        logoUrl: "https://console.akash.network/images/akash-logo.svg",
        amount: parseInt(coin.amount) / 1_000_000
      };
    } else if (coin.denom === "akt") {
      return {
        symbol: "AKT",
        logoUrl: "https://console.akash.network/images/akash-logo.svg",
        amount: parseFloat(coin.amount)
      };
    } else {
      const akashChain = asset_lists.find(c => c.chain_name === "akash");
      const ibcAsset = akashChain.assets.find(a => a.base === coin.denom);

      if (!ibcAsset) throw new Error(`Unknown asset ${coin.denom}`);

      const displayAsset = ibcAsset.denom_units.find(d => d.denom === ibcAsset.display);

      if (!displayAsset) throw new Error(`Unable to find display asset for ${coin.denom}`);

      const displayAmount = parseInt(coin.amount) / Math.pow(10, displayAsset.exponent);

      return {
        symbol: ibcAsset.symbol,
        ibcToken: coin.denom,
        logoUrl: ibcAsset.logo_URIs?.svg || ibcAsset?.logo_URIs?.png,
        description: ibcAsset?.description,
        amount: displayAmount
      };
    }
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);

    return {
      ibcToken: coin.denom,
      amount: parseFloat(coin.amount)
    };
  }
}
