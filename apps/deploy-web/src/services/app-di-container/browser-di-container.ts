import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { ApiUrlService } from "@src/services/api-url/api-url.service";
import networkStore from "@src/store/networkStore";
import * as walletUtils from "@src/utils/walletUtils";
import { AuthService } from "../auth/auth/auth.service";
import { withAnonymousUserToken, withUserToken } from "../auth/auth/interceptors";
import { createChildContainer } from "../container/createContainer";
import { DeploymentStorageService } from "../deployment-storage/deployment-storage.service";
import { BitbucketService } from "../remote-deploy/bitbucket-http.service";
import { GitHubService } from "../remote-deploy/github-http.service";
import { GitLabService } from "../remote-deploy/gitlab-http.service";
import { createAppRootContainer, withInterceptors } from "./app-di-container";

const rootContainer = createAppRootContainer({
  runtimeEnv: "browser",
  BASE_API_MAINNET_URL: browserEnvConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL,
  BASE_PROVIDER_PROXY_URL: browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL,
  MANAGED_WALLET_NETWORK_ID: browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
  apiUrlService: () => new ApiUrlService(browserEnvConfig)
});

export const services = createChildContainer(rootContainer, {
  notificationsApi: () =>
    createAPIClient({
      requestFn,
      baseUrl: "/api/proxy",
      queryClient: services.queryClient
    }),
  githubService: () => new GitHubService(services.internalApiHttpClient, services.createAxios),
  bitbucketService: () => new BitbucketService(services.internalApiHttpClient, services.createAxios),
  gitlabService: () => new GitLabService(services.internalApiHttpClient, services.createAxios),
  internalApiHttpClient: () =>
    withInterceptors(services.createAxios(), {
      request: [withAnonymousUserToken]
    }),
  consoleApiHttpClient: () =>
    services.applyAxiosInterceptors(services.createAxios({ baseURL: services.appConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL }), {
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
  networkStore: () => networkStore,
  appConfig: () => browserEnvConfig,
  authService: () => new AuthService(services.urlService, services.internalApiHttpClient),
  storedWalletsService: () => walletUtils,
  deploymentLocalStorage: () => new DeploymentStorageService(localStorage, services.networkStore)
});
