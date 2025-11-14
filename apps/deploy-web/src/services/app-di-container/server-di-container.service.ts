import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { getSession } from "@auth0/nextjs-auth0";
import { requestFn } from "@openapi-qraft/react";
import * as unleashModule from "@unleash/nextjs";
import httpProxy from "http-proxy";

import { serverEnvConfig } from "@src/config/server-env.config";
import { ApiUrlService } from "../api-url/api-url.service";
import { clientIpForwardingInterceptor } from "../client-ip-forwarding/client-ip-forwarding.interceptor";
import { createChildContainer } from "../container/createContainer";
import { FeatureFlagService } from "../feature-flag/feature-flag.service";
import { createAppRootContainer } from "./app-di-container";

const rootContainer = createAppRootContainer({
  ...serverEnvConfig,
  runtimeEnv: "nodejs",
  MANAGED_WALLET_NETWORK_ID: serverEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
  globalRequestMiddleware: clientIpForwardingInterceptor,
  apiUrlService: () => new ApiUrlService(serverEnvConfig)
});

export const services = createChildContainer(rootContainer, {
  getSession: () => getSession,
  httpProxy: () => ({ createProxyServer: httpProxy.createProxyServer }),
  featureFlagService: () => new FeatureFlagService(unleashModule, serverEnvConfig),
  notificationsApi: () =>
    createAPIClient({
      requestFn,
      baseUrl: serverEnvConfig.BASE_API_MAINNET_URL
    }),
  config: () => serverEnvConfig,
  consoleApiHttpClient: () => services.applyAxiosInterceptors(services.createAxios())
});

export type AppServices = typeof services;
