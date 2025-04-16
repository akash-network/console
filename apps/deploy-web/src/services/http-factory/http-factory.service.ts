import { ApiKeyHttpService, AuthHttpService, DeploymentSettingHttpService, TemplateHttpService, TxHttpService, UserHttpService } from "@akashnetwork/http-sdk";
import { StripeService } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import type { InternalAxiosRequestConfig } from "axios";
import axios from "axios";

import { analyticsService } from "@src/services/analytics/analytics.service";
import { authService } from "@src/services/auth/auth.service";
import { customRegistry } from "@src/utils/customRegistry";
import { ProviderProxyService } from "../provider-proxy/provider-proxy.service";

export const createServices = (config: ServicesConfig) => {
  const apiConfig = { baseURL: config.BASE_API_MAINNET_URL };
  const services = {
    user: new UserHttpService(apiConfig),
    stripe: new StripeService(apiConfig),
    tx: new TxHttpService(customRegistry, apiConfig),
    template: new TemplateHttpService(apiConfig),
    auth: new AuthHttpService(apiConfig),
    providerProxy: new ProviderProxyService({ baseURL: config.BASE_PROVIDER_PROXY_URL }),
    deploymentSetting: new DeploymentSettingHttpService(apiConfig),
    apiKey: new ApiKeyHttpService(),
    axios: axios.create()
  };

  if (config.globalRequestMiddleware) {
    Object.values(services).forEach(service => {
      service.interceptors.request.use(config.globalRequestMiddleware);
    });
  }

  services.user.interceptors.request.use(authService.withAnonymousUserHeader);
  services.stripe.interceptors.request.use(authService.withAnonymousUserHeader);
  services.tx.interceptors.request.use(authService.withAnonymousUserHeader);
  services.auth.interceptors.request.use(authService.withAnonymousUserHeader);
  services.deploymentSetting.interceptors.request.use(authService.withAnonymousUserHeader);
  services.user.interceptors.response.use(response => {
    if (response.config.url?.startsWith("/v1/anonymous-users") && response.config.method === "post" && response.status === 200) {
      analyticsService.track("anonymous_user_created", { category: "user", label: "Anonymous User Created" });
    }
    return response;
  });

  return services;
};

export interface ServicesConfig {
  BASE_API_MAINNET_URL: string;
  BASE_PROVIDER_PROXY_URL: string;
  globalRequestMiddleware?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
}
