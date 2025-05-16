import { ApiKeyHttpService, AuthHttpService, DeploymentSettingHttpService, TemplateHttpService, TxHttpService, UserHttpService } from "@akashnetwork/http-sdk";
import { StripeService } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import type { Axios, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios from "axios";

import { analyticsService } from "@src/services/analytics/analytics.service";
import { authService } from "@src/services/auth/auth.service";
import { customRegistry } from "@src/utils/customRegistry";
import { ConfigService } from "../config/config.service";
import { createContainer } from "../container/createContainer";
import { ProviderProxyService } from "../provider-proxy/provider-proxy.service";

export const createServices = (config: ServicesConfig) => {
  const apiConfig = { baseURL: config.BASE_API_MAINNET_URL };
  return createContainer({
    user: () =>
      withInterceptors(new UserHttpService(apiConfig), {
        request: [config.globalRequestMiddleware, authService.withAnonymousUserHeader],
        response: [
          response => {
            if (response.config.url?.startsWith("/v1/anonymous-users") && response.config.method === "post" && response.status === 200) {
              analyticsService.track("anonymous_user_created", { category: "user", label: "Anonymous User Created" });
            }
            return response;
          }
        ]
      }),
    stripe: () =>
      withInterceptors(new StripeService(apiConfig), {
        request: [config.globalRequestMiddleware, authService.withAnonymousUserHeader]
      }),
    tx: () =>
      withInterceptors(new TxHttpService(customRegistry, apiConfig), {
        request: [config.globalRequestMiddleware, authService.withAnonymousUserHeader]
      }),
    template: () =>
      withInterceptors(new TemplateHttpService(apiConfig), {
        request: [config.globalRequestMiddleware]
      }),
    auth: () =>
      withInterceptors(new AuthHttpService(apiConfig), {
        request: [config.globalRequestMiddleware, authService.withAnonymousUserHeader]
      }),
    providerProxy: () =>
      withInterceptors(new ProviderProxyService({ baseURL: config.BASE_PROVIDER_PROXY_URL }), {
        request: [config.globalRequestMiddleware]
      }),
    deploymentSetting: () =>
      withInterceptors(new DeploymentSettingHttpService(apiConfig), {
        request: [config.globalRequestMiddleware, authService.withAnonymousUserHeader]
      }),
    apiKey: () =>
      withInterceptors(new ApiKeyHttpService(), {
        request: [config.globalRequestMiddleware]
      }),
    axios: () =>
      withInterceptors(axios.create(), {
        request: [config.globalRequestMiddleware]
      }),
    config: () =>
      withInterceptors(new ConfigService(), {
        request: [config.globalRequestMiddleware]
      })
  });
};

export interface ServicesConfig {
  BASE_API_MAINNET_URL: string;
  BASE_PROVIDER_PROXY_URL: string;
  globalRequestMiddleware?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
}

function withInterceptors<T extends Axios>(axios: T, interceptors: Interceptors) {
  interceptors.request?.forEach(interceptor => axios.interceptors.request.use(interceptor));
  interceptors.response?.forEach(interceptor => axios.interceptors.response.use(interceptor));
  return axios;
}

type Interceptor<T> = (value: T) => T | Promise<T>;
interface Interceptors {
  request?: Array<Interceptor<InternalAxiosRequestConfig> | undefined>;
  response?: Array<Interceptor<AxiosResponse> | undefined>;
}
