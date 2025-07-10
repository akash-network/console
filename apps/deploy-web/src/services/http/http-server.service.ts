import { getSession } from "@auth0/nextjs-auth0";
import * as unleashModule from "@unleash/nextjs";

import { serverEnvConfig } from "@src/config/server-env.config";
import { createAppRootContainer } from "@src/services/app-di-container/app-di-container";
import { serverApiUrlService } from "../api-url/server-api-url.service";
import { clientIpForwardingInterceptor } from "../client-ip-forwarding/client-ip-forwarding.interceptor";
import { createChildContainer } from "../container/createContainer";
import { FeatureFlagService } from "../feature-flag/feature-flag.service";
import { notificationsApi } from "../server-side-notifications-api/server-side-notifications-api.service";

const rootContainer = createAppRootContainer({
  ...serverEnvConfig,
  runtimeEnv: "nodejs",
  BASE_PROVIDER_PROXY_URL: serverEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL,
  MANAGED_WALLET_NETWORK_ID: serverEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
  globalRequestMiddleware: clientIpForwardingInterceptor,
  apiUrlService: serverApiUrlService
});

export const services = createChildContainer(rootContainer, {
  getSession: () => getSession,
  featureFlagService: () => new FeatureFlagService(unleashModule, serverEnvConfig),
  notificationsApi: () => notificationsApi
});
