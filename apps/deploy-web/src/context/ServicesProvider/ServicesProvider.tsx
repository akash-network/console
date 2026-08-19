import React, { useContext, useMemo } from "react";
import type { NetworkId } from "@akashnetwork/chain-sdk/web";
import { AuthzHttpService, BmeHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { netConfig } from "@akashnetwork/net";

import { UACT_DENOM, UAKT_DENOM, USDC_IBC_DENOMS } from "@src/config/denom.config";
import { services as rootContainer } from "@src/services/app-di-container/browser-di-container";
import type { DIContainer, Factories } from "@src/services/container/createContainer";
import { createChildContainer } from "@src/services/container/createContainer";
import type { FallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import { createFallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import { WalletBalancesService } from "@src/services/wallet-balances/wallet-balances.service";
import type { BlockchainStatusContextType } from "../BlockchainStatusProvider/BlockchainStatusProvider";
import { useBlockchainStatus } from "../BlockchainStatusProvider/BlockchainStatusProvider";
import { ServicesContext } from "./ServicesContext";

export type Props = {
  children: React.ReactNode;
  services?: Partial<AppDIContainer extends DIContainer<infer TFactories> ? TFactories : never>;
};

export type AppDIContainer = ReturnType<typeof createAppContainer>;

export const ServicesProvider: React.FC<Props> = ({ children, services }) => {
  const blockchainStatus = useBlockchainStatus();
  const childContainer = useMemo(() => createAppContainer(blockchainStatus, services), [blockchainStatus.isBlockchainDown, services]);

  return <ServicesContext.Provider value={childContainer}>{children}</ServicesContext.Provider>;
};

export function useServices() {
  return useContext(ServicesContext) as AppDIContainer;
}

function createAppContainer<T extends Factories>(blockchainStatus: BlockchainStatusContextType, services: Partial<T> | undefined) {
  const di = createChildContainer(rootContainer, {
    authzHttpService: () => new AuthzHttpService(di.chainApiHttpClient),
    bmeHttpService: () => new BmeHttpService(di.chainApiHttpClient),
    leaseHttpService: () => new LeaseHttpService(di.chainApiHttpClient),
    walletBalancesService: () =>
      new WalletBalancesService(di.authzHttpService, di.chainApiHttpClient, {
        uakt: UAKT_DENOM,
        uact: UACT_DENOM,
        usdc: USDC_IBC_DENOMS[rootContainer.networkStore.selectedNetworkId as NetworkId]
      }),
    chainApiHttpClient: () => {
      let inflightPingRequest: Promise<{ isBlockchainDown: boolean }> | undefined;
      // keep track of the blockchain down status to make it instant
      // isBlockchainDown from the context is reactive and updated with a delay, according to react rendering cycle
      let isBlockchainDown = blockchainStatus.isBlockchainDown;
      const chainApiHttpClient: FallbackableHttpClient = rootContainer.applyAxiosInterceptors(
        createFallbackableHttpClient(rootContainer.createAxios, rootContainer.fallbackChainApiHttpClient, {
          baseURL: netConfig.getBaseAPIUrl(rootContainer.networkStore.selectedNetworkId),
          shouldFallback: () => isBlockchainDown || blockchainStatus.isBlockchainDown,
          onUnavailableError: (error): Promise<void> | void => {
            if (isBlockchainDown) return;

            // ensure blockchain is really unavailable and it's not an issue with some endpoint
            inflightPingRequest ??= chainApiHttpClient
              .get("/cosmos/base/tendermint/v1beta1/node_info", { adapter: "fetch", timeout: 5000 })
              .then(() => ({ isBlockchainDown: false }))
              .catch(() => {
                if (isBlockchainDown) return { isBlockchainDown: true };
                isBlockchainDown = true;
                blockchainStatus.setIsBlockchainDown(true);
                return { isBlockchainDown: true };
              })
              .finally(() => {
                setTimeout(() => {
                  inflightPingRequest = undefined;
                }, 10_000); // keep ping result in cache for few seconds to handle delayed requests
              });
            return inflightPingRequest.then(result => {
              if (!result.isBlockchainDown) {
                // if blockchain is available, then we have an issue with some endpoint
                // and want the original request to fail and NOT fallback to fallbackChainApiHttpClient
                return Promise.reject(error);
              }
            });
          },
          onSuccess: () => {
            if (isBlockchainDown) {
              isBlockchainDown = false;
              blockchainStatus.setIsBlockchainDown(false);
            }
          }
        })
      );
      return chainApiHttpClient;
    },
    ...services
  });

  return di;
}
