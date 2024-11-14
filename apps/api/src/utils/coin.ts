import { asset_lists } from "@chain-registry/assets";
import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";

const logger = LoggerService.forContext("CoinUtil");

export function coinToAsset(coin: Coin) {
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

    if (!ibcAsset) {
      logger.info(`Unknown asset ${coin.denom}`);

      return {
        ibcToken: coin.denom,
        amount: parseFloat(coin.amount)
      };
    }

    const displayAsset = ibcAsset.denom_units.find(d => d.denom === ibcAsset.display);

    if (!displayAsset) {
      logger.info(`Unable to find display asset for ${coin.denom}`);

      return {
        ibcToken: coin.denom,
        amount: parseFloat(coin.amount)
      };
    }

    const displayAmount = parseInt(coin.amount) / Math.pow(10, displayAsset.exponent);

    return {
      symbol: ibcAsset.symbol,
      ibcToken: coin.denom,
      logoUrl: ibcAsset.logo_URIs?.svg || ibcAsset?.logo_URIs?.png,
      description: ibcAsset?.description,
      amount: displayAmount
    };
  }
}
