import { ChainProvider } from "@cosmos-kit/react";
import { wallets as keplr } from "@cosmos-kit/keplr";
import { wallets as leap } from "@cosmos-kit/leap-extension";
import { wallets as cosmostation } from "@cosmos-kit/cosmostation";
import { customRegistry } from "@src/utils/customRegistry";
import { GasPrice } from "@cosmjs/stargate";
import { akash, akashAssetList, akashSandbox, akashSandboxAssetList, akashTestnet, akashTestnetAssetList } from "@src/chains";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { useChain } from "@cosmos-kit/react";
import { useSettings } from "../SettingsProvider";

type Props = {
  children: React.ReactNode;
};

export function CustomChainProvider({ children }: Props) {
  const { settings } = useSettings();

  return (
    <ChainProvider
      chains={[akash, akashSandbox, akashTestnet]}
      assetLists={[akashAssetList, akashSandboxAssetList, akashTestnetAssetList]}
      wallets={[...keplr, ...leap, ...cosmostation]}
      walletConnectOptions={{
        signClient: {
          projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
        }
      }}
      endpointOptions={{
        endpoints: {
          akash: { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
          "akash-sandbox": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] },
          "akash-testnet": { rest: [settings.apiEndpoint], rpc: [settings.rpcEndpoint] }
        }
      }}
      signerOptions={{
        preferredSignType: chain => "direct",
        signingStargate: chain => ({
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
