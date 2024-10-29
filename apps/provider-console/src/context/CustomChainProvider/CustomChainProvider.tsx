"use client";
import "@interchain-ui/react/styles";
import "@interchain-ui/react/globalStyles";

import { GasPrice } from "@cosmjs/stargate";
import { wallets as keplr } from "@cosmos-kit/keplr";
import { wallets as leap } from "@cosmos-kit/leap-extension";
import { ChainProvider } from "@cosmos-kit/react";
import { useChain } from "@cosmos-kit/react";

import { akash, akashSandbox, akashTestnet, assetLists } from "@src/chains";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { customRegistry } from "@src/utils/customRegistry";

type Props = {
  children: React.ReactNode;
};

export function CustomChainProvider({ children }: Props) {
  return (
    <ChainProvider
      chains={[akash, akashSandbox, akashTestnet]}
      assetLists={assetLists}
      wallets={[...keplr, ...leap]}
      sessionOptions={{
        duration: 31_556_926_000,
        callback: () => {
          window.localStorage.removeItem("cosmos-kit@2:core//current-wallet");
          window.location.reload();
        }
      }}
      walletConnectOptions={{
        signClient: {
          projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID as string
        }
      }}
      endpointOptions={{
        isLazy: true,
        endpoints: {
          akash: { rest: [], rpc: [] },
          "akash-sandbox": { rest: [], rpc: [] },
          "akash-testnet": { rest: [], rpc: [] }
        }
      }}
      signerOptions={{
        preferredSignType: () => "direct",
        signingStargate: (): any => ({
          registry: customRegistry,
          gasPrice: GasPrice.fromString("0.025uakt")
        })
      }}
    >
      {children}
    </ChainProvider>
  );
}

export function useSelectedChain() {
  const { chainRegistryName } = useSelectedNetwork();
  return useChain(chainRegistryName);
}
