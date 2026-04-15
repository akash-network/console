"use client";
import "@interchain-ui/react/styles";
import "@interchain-ui/react/globalStyles";

import { GasPrice } from "@cosmjs/stargate";
import { wallets as keplr } from "@cosmos-kit/keplr";
import { ChainProvider } from "@cosmos-kit/react";
import { useChain } from "@cosmos-kit/react";

import { assetLists } from "@src/chains";
import { createDynamicChain } from "@src/config/network.config";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { customRegistry } from "@src/utils/customRegistry";

type Props = {
  children: React.ReactNode;
};

export function CustomChainProvider({ children }: Props) {
  const availableWallets = [...keplr];

  // Create dynamic chain from environment configuration - no if/else conditions
  // Following the same pattern as akashSandbox but environment-driven
  const dynamicChain = createDynamicChain();

  return (
    <ChainProvider
      chains={[dynamicChain]}
      assetLists={assetLists}
      wallets={availableWallets}
      sessionOptions={{
        duration: 31_556_926_000, // 1 Year
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
          [dynamicChain.chain_name]: {
            rest: [dynamicChain.apis?.rest?.[0]?.address || ""],
            rpc: [dynamicChain.apis?.rpc?.[0]?.address || ""]
          }
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
