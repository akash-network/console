import React, { useContext } from "react";
import { AuthzHttpService, CertificatesService } from "@akashnetwork/http-sdk";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { DIContainer, Factories } from "@src/services/container/createContainer";
import { createChildContainer } from "@src/services/container/createContainer";
import { services as rootContainer } from "@src/services/http/http-browser.service";
import { WalletBalancesService } from "@src/services/wallet-balances/wallet-balances.service";
import type { Settings } from "../SettingsProvider/SettingsProviderContext";
import { useSettings } from "../SettingsProvider/SettingsProviderContext";
import { ServicesContext } from "./ServicesContext";

export type Props = {
  children: React.ReactNode;
  services?: Partial<AppDIContainer extends DIContainer<infer TFactories> ? TFactories : never>;
};

export type AppDIContainer = ReturnType<typeof createAppContainer>;

export const ServicesProvider: React.FC<Props> = ({ children, services }) => {
  const { settings } = useSettings();

  const childContainer = createAppContainer(settings, services as Factories);

  return <ServicesContext.Provider value={childContainer}>{children}</ServicesContext.Provider>;
};

export function useServices() {
  return useContext(ServicesContext) as AppDIContainer;
}

function createAppContainer<T extends Factories>(settings: Settings, services: T) {
  const di = createChildContainer(rootContainer, {
    authzHttpService: () => new AuthzHttpService({ baseURL: settings?.apiEndpoint }),
    walletBalancesService: () => new WalletBalancesService(di.authzHttpService, di.chainApiHttpClient, browserEnvConfig.NEXT_PUBLIC_MASTER_WALLET_ADDRESS),
    certificatesService: () => new CertificatesService(di.chainApiHttpClient),
    chainApiHttpClient: () => rootContainer.createAxios({ baseURL: settings?.apiEndpoint }),
    ...services
  });

  return di;
}
