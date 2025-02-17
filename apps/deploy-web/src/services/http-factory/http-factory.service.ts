import { ApiKeyHttpService, AuthHttpService, DeploymentSettingHttpService, TemplateHttpService, TxHttpService, UserHttpService } from "@akashnetwork/http-sdk";
import { StripeService } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import axios from "axios";

import { analyticsService } from "@src/services/analytics/analytics.service";
import { authService } from "@src/services/auth/auth.service";
import { customRegistry } from "@src/utils/customRegistry";
import { ProviderProxyService } from "../provider-proxy/provider-proxy.service";

export const createServices = (config: ServicesConfig) => {
  const apiConfig = { baseURL: config.BASE_API_MAINNET_URL };

  const user = new UserHttpService(apiConfig);
  const stripe = new StripeService(apiConfig);
  const tx = new TxHttpService(customRegistry, apiConfig);
  const template = new TemplateHttpService(apiConfig);
  const auth = new AuthHttpService(apiConfig);
  const providerProxy = new ProviderProxyService({ baseURL: config.BASE_PROVIDER_PROXY_URL });
  const deploymentSetting = new DeploymentSettingHttpService(apiConfig);
  const apiKey = new ApiKeyHttpService();

  user.interceptors.request.use(authService.withAnonymousUserHeader);
  stripe.interceptors.request.use(authService.withAnonymousUserHeader);
  tx.interceptors.request.use(authService.withAnonymousUserHeader);
  auth.interceptors.request.use(authService.withAnonymousUserHeader);
  deploymentSetting.interceptors.request.use(authService.withAnonymousUserHeader);
  user.interceptors.response.use(response => {
    if (response.config.url?.startsWith("/v1/anonymous-users") && response.config.method === "post" && response.status === 200) {
      analyticsService.track("anonymous_user_created", { category: "user", label: "Anonymous User Created" });
    }
    return response;
  });

  return { user, stripe, tx, template, auth, providerProxy, deploymentSetting, apiKey, axios };
};

export interface ServicesConfig {
  BASE_API_MAINNET_URL: string;
  BASE_PROVIDER_PROXY_URL: string;
}
