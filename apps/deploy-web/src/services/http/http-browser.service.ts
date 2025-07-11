import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { createAppRootContainer } from "@src/services/app-di-container/app-di-container";
import { browserApiUrlService } from "../api-url/browser-api-url.service";
import { createChildContainer } from "../container/createContainer";
import { UserProviderService } from "../user-provider/user-provider.service";

const rootContainer = createAppRootContainer({
  runtimeEnv: "browser",
  BASE_API_MAINNET_URL: browserEnvConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL,
  BASE_PROVIDER_PROXY_URL: browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL,
  MANAGED_WALLET_NETWORK_ID: browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
  apiUrlService: browserApiUrlService
});

export const services = createChildContainer(rootContainer, {
  userProviderService: () => new UserProviderService(),
  notificationsApi: () =>
    createAPIClient({
      requestFn,
      baseUrl: "/api/proxy",
      queryClient: services.queryClient
    })
});
