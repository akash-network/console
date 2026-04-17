import { GasPrice } from "@cosmjs/stargate";

import { assetLists, chains } from "@src/chains";
import type { ChainStoreProviderProps, WalletsRegistry } from "@src/lib/cosmos-kit-jotai";
import { ChainStoreInitializer, ChainStoreProvider, CURRENT_WALLET_KEY, ModalWrapper } from "@src/lib/cosmos-kit-jotai";
import { registry } from "@src/utils/customRegistry";
import { useServices } from "../ServicesProvider";

type Props = {
  children: React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  ChainStoreProvider,
  ModalWrapper,
  ChainStoreInitializer,
  useServices
};

/**
 * The order of entries is important here.
 * Wallets are rendered in the order they are specified in this registry.
 * Each entry maps wallet names to a shared loader so each package is imported only once.
 */
const WALLETS_PROVIDERS: WalletsRegistry = [
  { names: ["keplr-extension", "keplr-mobile"], loader: () => import("@cosmos-kit/keplr") },
  { names: ["leap-extension", "leap-mobile", "leap-metamask-cosmos-snap"], loader: () => import("@cosmos-kit/leap") },
  { names: ["cosmostation-extension"], loader: () => import("@cosmos-kit/cosmostation-extension") },
  { names: ["cosmos-extension-metamask"], loader: () => import("@cosmos-kit/cosmos-extension-metamask") }
];

const walletManagerOptions: ChainStoreProviderProps["walletManagerOptions"] = {
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
    // @ts-expect-error - Mixed @cosmjs/proto-signing library versions. Need to align them
    signingStargate: () => ({
      registry: registry,
      gasPrice: GasPrice.fromString("0.025uakt")
    })
  }
};

export function CustomChainProvider({ children, dependencies: d = DEPENDENCIES }: Props) {
  return (
    <d.ChainStoreProvider walletsRegistry={WALLETS_PROVIDERS} walletManagerOptions={walletManagerOptions}>
      <d.ModalWrapper />
      <InitializeChainStoreForSelectedNetwork dependencies={d} />
      {children}
    </d.ChainStoreProvider>
  );
}

function InitializeChainStoreForSelectedNetwork({ dependencies: d = DEPENDENCIES }: Pick<Props, "dependencies">) {
  const { networkStore } = d.useServices();
  const selectedNetwork = networkStore.useSelectedNetwork();

  return <d.ChainStoreInitializer chainName={selectedNetwork.chainRegistryName} />;
}
