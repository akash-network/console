import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import { ApiKeyHttpService, AuthHttpService, DeploymentSettingHttpService, TemplateHttpService, TxHttpService, UserHttpService } from "@akashnetwork/http-sdk";
import { StripeService } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import { LoggerService } from "@akashnetwork/logging";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { Axios, AxiosInstance, AxiosResponse, CreateAxiosDefaults, InternalAxiosRequestConfig } from "axios";
import axios from "axios";

import { analyticsService } from "@src/services/analytics/analytics.service";
import { customRegistry } from "@src/utils/customRegistry";
import { generateTraceparent } from "@src/utils/otel";
import type { ApiUrlService } from "../api-url/api-url.service";
import { AuthService } from "../auth/auth.service";
import { createContainer } from "../container/createContainer";
import { ErrorHandlerService } from "../error-handler/error-handler.service";
import { ManagedWalletHttpService } from "../managed-wallet-http/managed-wallet-http.service";
import { ProviderProxyService } from "../provider-proxy/provider-proxy.service";

export const createAppRootContainer = (config: ServicesConfig) => {
  const apiConfig = { baseURL: config.BASE_API_MAINNET_URL };
  const container = createContainer({
    authService: () => new AuthService(),
    user: () =>
      withInterceptors(new UserHttpService(apiConfig), {
        request: [config.globalRequestMiddleware, container.authService.withAnonymousUserHeader, otelInterceptor],
        response: [
          response => {
            if (response.config.url?.startsWith("/v1/anonymous-users") && response.config.method === "post" && response.status === 200) {
              container.analyticsService.track("anonymous_user_created", { category: "user", label: "Anonymous User Created" });
            }
            return response;
          }
        ]
      }),
    stripe: () =>
      withInterceptors(new StripeService(apiConfig), {
        request: [config.globalRequestMiddleware, container.authService.withAnonymousUserHeader, otelInterceptor]
      }),
    tx: () =>
      withInterceptors(new TxHttpService(customRegistry, apiConfig), {
        request: [config.globalRequestMiddleware, container.authService.withAnonymousUserHeader, otelInterceptor]
      }),
    template: () =>
      withInterceptors(new TemplateHttpService(apiConfig), {
        request: [config.globalRequestMiddleware, otelInterceptor]
      }),
    auth: () =>
      withInterceptors(new AuthHttpService(apiConfig), {
        request: [config.globalRequestMiddleware, container.authService.withAnonymousUserHeader, otelInterceptor]
      }),
    providerProxy: () => new ProviderProxyService(container.createTracedAxios({ baseURL: config.BASE_PROVIDER_PROXY_URL })),
    deploymentSetting: () =>
      withInterceptors(new DeploymentSettingHttpService(apiConfig), {
        request: [config.globalRequestMiddleware, container.authService.withAnonymousUserHeader, otelInterceptor]
      }),
    apiKey: () =>
      withInterceptors(new ApiKeyHttpService(), {
        request: [config.globalRequestMiddleware, otelInterceptor]
      }),
    axios: () => container.createAxios(),
    createTracedAxios:
      () =>
      (options?: CreateAxiosDefaults): AxiosInstance =>
        withInterceptors(container.createAxios(options), {
          request: [otelInterceptor]
        }),
    createAxios:
      () =>
      (options?: CreateAxiosDefaults): AxiosInstance =>
        withInterceptors(axios.create(options), {
          request: [config.globalRequestMiddleware]
        }),
    certificateManager: () => certificateManager,
    analyticsService: () => analyticsService,
    apiUrlService: () => config.apiUrlService,
    managedWalletService: () =>
      withInterceptors(
        new ManagedWalletHttpService(
          {
            baseURL: container.apiUrlService.getBaseApiUrlFor(config.MANAGED_WALLET_NETWORK_ID)
          },
          container.analyticsService
        ),
        {
          request: [config.globalRequestMiddleware, container.authService.withAnonymousUserHeader, otelInterceptor],
          response: [
            response => {
              if (response.config.url === "v1/start-trial" && response.config.method === "post" && response.status === 200) {
                container.analyticsService.track("trial_started", { category: "billing", label: "Trial Started" });
              }
              return response;
            }
          ]
        }
      ),
    queryClient: () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: error => container.errorHandler.reportError({ error })
        }),
        mutationCache: new MutationCache({
          onError: error => container.errorHandler.reportError({ error })
        })
      }),
    errorHandler: () => new ErrorHandlerService(container.logger),
    logger: () => new LoggerService({ name: `app-${config.runtimeEnv}` })
  });

  return container;
};

export interface ServicesConfig {
  BASE_API_MAINNET_URL: string;
  BASE_PROVIDER_PROXY_URL: string;
  MANAGED_WALLET_NETWORK_ID: NetworkId;
  globalRequestMiddleware?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
  runtimeEnv: "nodejs" | "browser";
  apiUrlService: ApiUrlService;
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

function otelInterceptor(config: InternalAxiosRequestConfig) {
  config.headers.set("Traceparent", generateTraceparent());
  return config;
}
