import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";
import * as unleashModule from "@unleash/nextjs";

import { serverEnvConfig } from "@src/config/server-env.config";
import { getSession } from "@src/lib/auth0";
import { ApiUrlService } from "../api-url/api-url.service";
import { clientIpForwardingInterceptor } from "../client-ip-forwarding/client-ip-forwarding.interceptor";
import { createChildContainer } from "../container/createContainer";
import { FeatureFlagService } from "../feature-flag/feature-flag.service";
import { SessionService } from "../session/session.service";
import { TurnstileVerifierService } from "../turnstile-verifier/turnstile-verifier.service";
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
  featureFlagService: () => new FeatureFlagService(unleashModule, serverEnvConfig),
  notificationsApi: () =>
    createAPIClient({
      requestFn,
      baseUrl: services.apiUrlService.getBaseApiUrlFor(services.privateConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID)
    }),
  privateConfig: () => Object.freeze(serverEnvConfig),
  consoleApiHttpClient: () => services.applyAxiosInterceptors(services.createAxios()),
  sessionService: () =>
    new SessionService(
      services.externalApiHttpClient,
      services.applyAxiosInterceptors(
        services.createAxios({
          baseURL: services.apiUrlService.getBaseApiUrlFor(services.privateConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID),
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json"
          }
        })
      ),
      {
        ISSUER_BASE_URL: services.privateConfig.AUTH0_ISSUER_BASE_URL,
        CLIENT_ID: services.privateConfig.AUTH0_CLIENT_ID,
        CLIENT_SECRET: services.privateConfig.AUTH0_CLIENT_SECRET,
        AUDIENCE: services.privateConfig.AUTH0_AUDIENCE
      }
    ),
  captchaVerifier: () =>
    new TurnstileVerifierService(services.externalApiHttpClient, {
      secretKey: services.privateConfig.TURNSTILE_SECRET_KEY,
      turnstileBypassSecretKey: services.privateConfig.TURNSTILE_BYPASS_SECRET_KEY,
      bypassSecretKeyVerificationToken: services.privateConfig.E2E_TESTING_CLIENT_TOKEN
    })
});

export type AppServices = typeof services;
