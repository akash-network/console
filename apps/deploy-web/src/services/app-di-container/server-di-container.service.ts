import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";
import * as unleashModule from "@unleash/nextjs";
import httpProxy from "http-proxy";

import { serverEnvConfig } from "@src/config/server-env.config";
import { getSession } from "@src/lib/auth0";
import { ApiUrlService } from "../api-url/api-url.service";
import { clientIpForwardingInterceptor } from "../client-ip-forwarding/client-ip-forwarding.interceptor";
import { createChildContainer } from "../container/createContainer";
import { FeatureFlagService } from "../feature-flag/feature-flag.service";
import { SessionService } from "../session/session.service";
import { createAppRootContainer } from "./app-di-container";

const rootContainer = createAppRootContainer({
  ...serverEnvConfig,
  runtimeEnv: "nodejs",
  BASE_PROVIDER_PROXY_URL: serverEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL,
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
      baseUrl: services.apiUrlService.getBaseApiUrlFor(services.config.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID)
    }),
  config: () => serverEnvConfig,
  consoleApiHttpClient: () => services.applyAxiosInterceptors(services.createAxios()),
  sessionService: () =>
    new SessionService(
      services.externalApiHttpClient,
      services.applyAxiosInterceptors(
        services.createAxios({
          baseURL: services.apiUrlService.getBaseApiUrlFor(services.config.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID),
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json"
          }
        })
      ),
      {
        ISSUER_BASE_URL: services.config.AUTH0_ISSUER_BASE_URL,
        CLIENT_ID: services.config.AUTH0_CLIENT_ID,
        CLIENT_SECRET: services.config.AUTH0_CLIENT_SECRET,
        AUDIENCE: services.config.AUTH0_AUDIENCE
      }
    )
});

export type AppServices = typeof services;
