import React, { useContext } from "react";
import { AuthzHttpService } from "@akashnetwork/http-sdk";
import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { queryClient } from "@src/queries/queryClient";
import { browserApiUrlService } from "@src/services/api-url/browser-api-url.service";
import type { DIContainer, Factories } from "@src/services/container/createContainer";
import { createChildContainer } from "@src/services/container/createContainer";
import { services as rootContainer } from "@src/services/http/http-browser.service";
import { WalletBalancesService } from "@src/services/wallet-balances/wallet-balances.service";
import type { Settings } from "../SettingsProvider/SettingsProviderContext";
import { useSettings } from "../SettingsProvider/SettingsProviderContext";

type Props = {
  children: React.ReactNode;
  services?: Partial<AppDIContainer extends DIContainer<infer TFactories> ? TFactories : never>;
};

export type AppDIContainer = ReturnType<typeof createAppContainer>;
const ServicesContext = React.createContext<AppDIContainer>({} as AppDIContainer);

export const ServicesProvider: React.FC<Props> = ({ children, services }) => {
  const { settings } = useSettings();

  const childContainer = createAppContainer(settings, services as Factories);

  return <ServicesContext.Provider value={childContainer}>{children}</ServicesContext.Provider>;
};

export function useServices() {
  return useContext(ServicesContext);
}

function createAppContainer<T extends Factories>(settings: Settings, services: T) {
  const di = createChildContainer(rootContainer, {
    browserApiUrlService: () => browserApiUrlService,
    notificationsApi: () =>
      createAPIClient({
        requestFn,
        baseUrl: "/api/proxy",
        queryClient
      }),
    authzHttpService: () => new AuthzHttpService({ baseURL: settings.apiEndpoint }),
    walletBalancesService: () =>
      new WalletBalancesService(di.authzHttpService, di.axios, browserEnvConfig.NEXT_PUBLIC_MASTER_WALLET_ADDRESS, settings.apiEndpoint),
    ...services
  });

  return di;
}
