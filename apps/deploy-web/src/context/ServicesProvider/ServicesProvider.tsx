import React, { useContext } from "react";
import { AuthzHttpService, CertificatesService } from "@akashnetwork/http-sdk";

import { withInterceptors } from "@src/services/app-di-container/app-di-container";
import { services as rootContainer } from "@src/services/app-di-container/browser-di-container";
import type { DIContainer, Factories } from "@src/services/container/createContainer";
import { createChildContainer } from "@src/services/container/createContainer";
import type { FallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import { createFallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import { WalletBalancesService } from "@src/services/wallet-balances/wallet-balances.service";
import type { SettingsContextType } from "../SettingsProvider/SettingsProviderContext";
import { useSettings } from "../SettingsProvider/SettingsProviderContext";
import { ServicesContext } from "./ServicesContext";

export type Props = {
  children: React.ReactNode;
  services?: Partial<AppDIContainer extends DIContainer<infer TFactories> ? TFactories : never>;
};

export type AppDIContainer = ReturnType<typeof createAppContainer>;

export const ServicesProvider: React.FC<Props> = ({ children, services }) => {
  const settingsState = useSettings();

  const childContainer = createAppContainer(settingsState, services as Factories);

  return <ServicesContext.Provider value={childContainer}>{children}</ServicesContext.Provider>;
};

export function useServices() {
  return useContext(ServicesContext) as AppDIContainer;
}

const neverResolvedPromise = new Promise<never>(() => {});
function createAppContainer<T extends Factories>(settingsState: SettingsContextType, services: T) {
  const di = createChildContainer(rootContainer, {
    authzHttpService: () => new AuthzHttpService(di.chainApiHttpClient),
    walletBalancesService: () => new WalletBalancesService(di.authzHttpService, di.chainApiHttpClient, di.appConfig.NEXT_PUBLIC_MASTER_WALLET_ADDRESS),
    certificatesService: () => new CertificatesService(di.chainApiHttpClient),
    chainApiHttpClient: () => {
      let inflightPingRequest: Promise<{ isBlockchainDown: boolean }> | undefined;
      // keep track of the blockchain down status to make it instant
      // settings from useSettings hook is reactive and updated with a delay, according to react rendering cycle
      let isBlockchainDown = settingsState.settings?.isBlockchainDown;
      const chainApiHttpClient: FallbackableHttpClient = withInterceptors(
        createFallbackableHttpClient(rootContainer.createAxios, rootContainer.fallbackChainApiHttpClient, {
          baseURL: settingsState.settings?.apiEndpoint,
          shouldFallback: () => isBlockchainDown || !!settingsState.settings?.isBlockchainDown,
          onUnavailableError: (error): Promise<void> | void => {
            if (isBlockchainDown) return;

            // ensure blockchain is really unavailable and it's not an issue with some endpoint
            inflightPingRequest ??= chainApiHttpClient
              .get("/cosmos/base/tendermint/v1beta1/node_info", { adapter: "fetch", timeout: 5000 })
              .then(() => ({ isBlockchainDown: false }))
              .catch(() => {
                if (isBlockchainDown) return { isBlockchainDown: true };
                isBlockchainDown = true;
                settingsState.setSettings(prev => ({ ...prev, isBlockchainDown: true }));
                return { isBlockchainDown: true };
              })
              .finally(() => {
                setTimeout(() => {
                  inflightPingRequest = undefined;
                }, 10_000); // keep ping result in cache for few seconds to handle delayed requests
              });
            return inflightPingRequest.then(result => {
              if (!result.isBlockchainDown) {
                // if blockchain is available, then we have an issue wit some endpoint
                // and want the original request to fail and NOT fallback to fallbackChainApiHttpClient
                return Promise.reject(error);
              }
            });
          },
          onSuccess: () => {
            if (isBlockchainDown) {
              settingsState.refreshNodeStatuses();
            }
          }
        }),
        {
          request: [config => (config.baseURL ? config : neverResolvedPromise)]
        }
      );
      return chainApiHttpClient;
    },
    ...services
  });

  return di;
}
