import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import {
  ApiKeyHttpService,
  AuthHttpService,
  DeploymentSettingHttpService,
  TemplateHttpService,
  TxHttpService,
  UsageHttpService,
  UserHttpService
} from "@akashnetwork/http-sdk";
import { StripeService } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import { LoggerService } from "@akashnetwork/logging";
import { getTraceData } from "@sentry/nextjs";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { Axios, AxiosInstance, AxiosResponse, CreateAxiosDefaults, InternalAxiosRequestConfig } from "axios";
import axios from "axios";

import { analyticsService } from "@src/services/analytics/analytics.service";
import { customRegistry } from "@src/utils/customRegistry";
import type { ApiUrlService } from "../api-url/api-url.service";
import { AuthService } from "../auth/auth.service";
import { createContainer } from "../container/createContainer";
import { ErrorHandlerService } from "../error-handler/error-handler.service";
import { ManagedWalletHttpService } from "../managed-wallet-http/managed-wallet-http.service";
import { ProviderProxyService } from "../provider-proxy/provider-proxy.service";

export const createAppRootContainer = (config: ServicesConfig) => {
  const apiConfig = { baseURL: config.BASE_API_MAINNET_URL };
  const container = createContainer({
    getTraceData: () => getTraceData,
    applyAxiosInterceptors: (): typeof withInterceptors => {
      const otelInterceptor = (config: InternalAxiosRequestConfig) => {
        const traceData = container.getTraceData();
        if (traceData?.["sentry-trace"]) config.headers.set("Traceparent", traceData["sentry-trace"]);
        if (traceData?.baggage) config.headers.set("Baggage", traceData.baggage);
        return config;
      };
      return (axiosInstance, interceptors?) =>
        withInterceptors(axiosInstance, {
          request: [config.globalRequestMiddleware, otelInterceptor, ...(interceptors?.request || [])],
          response: [...(interceptors?.response || [])]
        });
    },
    authService: () => new AuthService(),
    user: () =>
      container.applyAxiosInterceptors(new UserHttpService(apiConfig), {
        request: [container.authService.withAnonymousUserHeader],
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
      container.applyAxiosInterceptors(new StripeService(apiConfig), {
        request: [container.authService.withAnonymousUserHeader]
      }),
    tx: () =>
      container.applyAxiosInterceptors(new TxHttpService(customRegistry, apiConfig), {
        request: [container.authService.withAnonymousUserHeader]
      }),
    template: () =>
      container.applyAxiosInterceptors(new TemplateHttpService(apiConfig), {
        request: [container.authService.withAnonymousUserHeader]
      }),
    usage: () =>
      withInterceptors(new UsageHttpService(apiConfig), {
        request: [config.globalRequestMiddleware, otelInterceptor]
      }),
    auth: () =>
      container.applyAxiosInterceptors(new AuthHttpService(apiConfig), {
        request: [container.authService.withAnonymousUserHeader]
      }),
    providerProxy: () =>
      new ProviderProxyService(
        container.applyAxiosInterceptors(container.createAxios({ baseURL: config.BASE_PROVIDER_PROXY_URL }), {
          request: [container.authService.withAnonymousUserHeader]
        })
      ),
    deploymentSetting: () =>
      container.applyAxiosInterceptors(new DeploymentSettingHttpService(apiConfig), {
        request: [container.authService.withAnonymousUserHeader]
      }),
    apiKey: () =>
      container.applyAxiosInterceptors(new ApiKeyHttpService(), {
        request: [container.authService.withAnonymousUserHeader]
      }),
    axios: () => container.createAxios(),
    createAxios:
      () =>
      (options?: CreateAxiosDefaults): AxiosInstance =>
        withInterceptors(axios.create(options), {
          request: [config.globalRequestMiddleware]
        }),
    certificateManager: () => certificateManager,
    analyticsService: () => analyticsService,
    apiUrlService: config.apiUrlService,
    managedWalletService: () =>
      container.applyAxiosInterceptors(
        new ManagedWalletHttpService(
          {
            baseURL: container.apiUrlService.getBaseApiUrlFor(config.MANAGED_WALLET_NETWORK_ID)
          },
          container.analyticsService
        ),
        {
          request: [container.authService.withAnonymousUserHeader],
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
  apiUrlService: () => ApiUrlService;
}

function withInterceptors<T extends Axios | AxiosInstance = AxiosInstance>(axios: T, interceptors: Interceptors) {
  interceptors.request?.forEach(interceptor => axios.interceptors.request.use(interceptor));
  interceptors.response?.forEach(interceptor => axios.interceptors.response.use(interceptor));
  return axios;
}

type Interceptor<T> = (value: T) => T | Promise<T>;
interface Interceptors {
  request?: Array<Interceptor<InternalAxiosRequestConfig> | undefined>;
  response?: Array<Interceptor<AxiosResponse> | undefined>;
}
