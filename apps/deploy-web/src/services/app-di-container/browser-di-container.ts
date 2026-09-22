import { createProxy } from "@akashnetwork/react-query-proxy";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import { ApiUrlService } from "@src/services/api-url/api-url.service";
import * as walletUtils from "@src/utils/walletUtils";
import { AuthService } from "../auth/auth/auth.service";
import { PROXY_API_BASE_URL, withUserToken } from "../auth/auth/interceptors";
import { createChildContainer } from "../container/createContainer";
import { DeploymentNameBackfillService } from "../deployment-name-backfill/deployment-name-backfill.service";
import { DeploymentStorageService } from "../deployment-storage/deployment-storage.service";
import { createSessionExpiryFetch } from "../session-expiry-notifier/session-expiry-notifier.service";
import { createAppRootContainer } from "./app-di-container";

const rootContainer = createAppRootContainer({
  runtimeEnv: "browser",
  BASE_API_MAINNET_URL: browserEnvConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL,
  BASE_PROVIDER_PROXY_URL: browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL,
  MANAGED_WALLET_NETWORK_ID: browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
  apiUrlService: () => new ApiUrlService(browserEnvConfig)
});

export const services = createChildContainer(rootContainer, {
  api: () => createProxy(createApiSdk({ baseUrl: PROXY_API_BASE_URL, fetch: createSessionExpiryFetch(services.sessionExpiryNotifier) })),
  internalApiHttpClient: () => services.createAxios(),
  consoleApiHttpClient: () =>
    services.applyAxiosInterceptors(services.createAxios({ baseURL: services.publicConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL }), {
      request: [withUserToken]
    }),
  /** TODO: https://github.com/akash-network/console/issues/1720 */
  publicConsoleApiHttpClient: () => services.applyAxiosInterceptors(services.createAxios()),
  fallbackChainApiHttpClient: () =>
    services.applyAxiosInterceptors(services.createAxios(), {
      request: [
        config => {
          config.baseURL = services.apiUrlService.getBaseApiUrlFor(services.networkStore.selectedNetworkId);
          return config;
        }
      ]
    }),
  authService: () => new AuthService(services.urlService, services.internalApiHttpClient),
  storedWalletsService: () => walletUtils,
  deploymentLocalStorage: () => new DeploymentStorageService(localStorage, services.networkStore),
  deploymentNameBackfill: () => new DeploymentNameBackfillService(),
  windowLocation: () => window.location,
  windowHistory: () => window.history
});
