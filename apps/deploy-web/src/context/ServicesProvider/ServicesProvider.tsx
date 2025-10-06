import React, { useContext } from "react";
import { AuthzHttpService, CertificatesService } from "@akashnetwork/http-sdk";

import { withInterceptors } from "@src/services/app-di-container/app-di-container";
import { services as rootContainer } from "@src/services/app-di-container/browser-di-container";
import type { DIContainer, Factories } from "@src/services/container/createContainer";
import { createChildContainer } from "@src/services/container/createContainer";
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
    chainApiHttpClient: () =>
      withInterceptors(
        createFallbackableHttpClient(rootContainer.createAxios, rootContainer.fallbackChainApiHttpClient, {
          baseURL: settingsState.settings?.apiEndpoint,
          shouldFallback: () => settingsState.settings?.isBlockchainDown,
          onUnavailableError: () => {
            if (settingsState.settings?.isBlockchainDown) return;
            settingsState.setSettings(prev => ({ ...prev, isBlockchainDown: true }));
          },
          onSuccess: () => {
            settingsState.refreshNodeStatuses();
          }
        }),
        {
          request: [config => (config.baseURL ? config : neverResolvedPromise)]
        }
      ),
    ...services
  });

  return di;
}
