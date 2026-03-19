import { GasPrice } from "@cosmjs/stargate";
import type { MainWalletBase } from "@cosmos-kit/core";
import { Logger, WalletManager } from "@cosmos-kit/core";

import { akash, akashSandbox, akashTestnet, assetLists } from "@src/chains";
import { registry } from "@src/utils/customRegistry";

export const CURRENT_WALLET_KEY = "cosmos-kit@2:core//current-wallet";

export function createWalletManager(wallets: MainWalletBase[]): WalletManager {
  const logger = new Logger("WARN");

  return new WalletManager(
    [akash, akashSandbox, akashTestnet],
    wallets,
    logger,
    false, // throwErrors
    true, // subscribeConnectEvents
    [
      "http://localhost:*",
      "https://localhost:*",
      "https://app.osmosis.zone",
      "https://daodao.zone",
      "https://dao.daodao.zone",
      "https://my.abstract.money",
      "https://apps.abstract.money",
      "https://console.abstract.money"
    ],
    assetLists,
    "icns", // defaultNameService
    {
      signClient: {
        projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string
      }
    },
    {
      preferredSignType: () => "direct",
      signingStargate: () =>
        ({
          registry,
          gasPrice: GasPrice.fromString("0.025uakt")
        }) as any
    },
    {
      isLazy: true,
      endpoints: {
        akash: { rest: [], rpc: [] },
        "akash-sandbox": { rest: [], rpc: [] },
        "akash-testnet": { rest: [], rpc: [] }
      }
    },
    {
      duration: 31_556_926_000, // 1 year
      callback: () => {
        window.localStorage.removeItem(CURRENT_WALLET_KEY);
        window.location.reload();
      }
    }
  );
}
