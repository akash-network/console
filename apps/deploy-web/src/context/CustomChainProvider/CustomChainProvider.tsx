import { GasPrice } from "@cosmjs/stargate";
import type { MainWalletBase } from "@cosmos-kit/core";

import { assetLists, chains } from "@src/chains";
import { ChainStoreInitializer, ChainStoreProvider, CURRENT_WALLET_KEY, ModalWrapper } from "@src/lib/cosmos-kit-jotai";
import { useServices } from "../ServicesProvider";

type Props = {
  children: React.ReactNode;
};

/**
 * The order of keys is important here.
 * Wallets are rendered in the order they are specified in this registry
 */
const registry: Record<string, () => Promise<{ wallets: MainWalletBase[] }>> = {
  "keplr-extension": () => import("@cosmos-kit/keplr"),
  "leap-extension": () => import("@cosmos-kit/leap"),
  "cosmostation-extension": () => import("@cosmos-kit/cosmostation-extension"),
  "cosmos-extension-metamask": () => import("@cosmos-kit/cosmos-extension-metamask"),
  "keplr-mobile": () => import("@cosmos-kit/keplr"),
  "leap-mobile": () => import("@cosmos-kit/leap")
};

const walletManagerOptions = {
  chains,
  assetList: assetLists,
  sessionOptions: {
    duration: 31_556_926_000, // 1 year
    callback: () => {
      window.localStorage.removeItem(CURRENT_WALLET_KEY);
      window.location.reload();
    }
  },
  walletConnectOptions: {
    signClient: {
      projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string
    }
  },
  endpointOptions: {
    isLazy: true,
    endpoints: {
      ...Object.fromEntries(chains.map(c => [c.chain_name, { rest: [], rpc: [] }]))
    }
  },
  signerOptions: {
    preferredSignType: () => "direct" as const,
    signingStargate: () =>
      ({
        registry,
        gasPrice: GasPrice.fromString("0.025uakt")
      }) as any
  }
};

export function CustomChainProvider({ children }: Props) {
  const { networkStore } = useServices();
  const selectedNetwork = networkStore.useSelectedNetwork();
  return (
    <ChainStoreProvider walletsRegistry={registry} walletManagerOptions={walletManagerOptions}>
      <ModalWrapper />
      <ChainStoreInitializer chainName={selectedNetwork.chainRegistryName} />
      {children}
    </ChainStoreProvider>
  );
}
