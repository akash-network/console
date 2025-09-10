import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import type { NetworkId } from "@akashnetwork/akashjs/build/types/network";
import {
  ApiKeyHttpService,
  AuthHttpService,
  createHttpClient,
  DeploymentSettingHttpService,
  TemplateHttpService,
  TxHttpService,
  UsageHttpService,
  UserHttpService
} from "@akashnetwork/http-sdk";
import { StripeService as HttpStripeService } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import { LoggerService } from "@akashnetwork/logging";
import { getTraceData } from "@sentry/nextjs";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { Axios, AxiosInstance, AxiosResponse, CreateAxiosDefaults, InternalAxiosRequestConfig } from "axios";

import { analyticsService } from "@src/services/analytics/analytics.service";
import { customRegistry } from "@src/utils/customRegistry";
import { UrlService } from "@src/utils/urlUtils";
import type { ApiUrlService } from "../api-url/api-url.service";
import { withUserToken } from "../auth/auth/interceptors";
import { createContainer } from "../container/createContainer";
import { ErrorHandlerService } from "../error-handler/error-handler.service";
import { ManagedWalletHttpService } from "../managed-wallet-http/managed-wallet-http.service";
import { ProviderProxyService } from "../provider-proxy/provider-proxy.service";
import { StripeService } from "../stripe/stripe.service";
import { UserTracker } from "../user-tracker/user-tracker.service";

export const createAppRootContainer = (config: ServicesConfig) => {
  const apiConfig = { baseURL: config.BASE_API_MAINNET_URL, adapter: "fetch" };
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
    user: () =>
      container.applyAxiosInterceptors(new UserHttpService(apiConfig), {
        request: [withUserToken],
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
      container.applyAxiosInterceptors(new HttpStripeService(apiConfig), {
        request: [withUserToken]
      }),
    stripeService: () => new StripeService(),
    tx: () =>
      container.applyAxiosInterceptors(new TxHttpService(customRegistry, apiConfig), {
        request: [withUserToken]
      }),
    template: () => container.applyAxiosInterceptors(new TemplateHttpService(apiConfig)),
    usage: () =>
      container.applyAxiosInterceptors(new UsageHttpService(apiConfig), {
        request: [withUserToken]
      }),
    auth: () =>
      container.applyAxiosInterceptors(new AuthHttpService(apiConfig), {
        request: [withUserToken]
      }),
    providerProxy: () => new ProviderProxyService(container.applyAxiosInterceptors(container.createAxios({ baseURL: config.BASE_PROVIDER_PROXY_URL }), {})),
    deploymentSetting: () =>
      container.applyAxiosInterceptors(new DeploymentSettingHttpService(apiConfig), {
        request: [withUserToken]
      }),
    apiKey: () =>
      container.applyAxiosInterceptors(new ApiKeyHttpService(apiConfig), {
        request: [withUserToken]
      }),
    externalApiHttpClient: () =>
      container.createAxios({
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      }),
    createAxios:
      () =>
      (options?: CreateAxiosDefaults): AxiosInstance =>
        withInterceptors(createHttpClient({ ...options, adapter: "fetch" }), {
          request: [config.globalRequestMiddleware]
        }),
    certificateManager: () => certificateManager,
    analyticsService: () => analyticsService,
    apiUrlService: config.apiUrlService,
    managedWalletService: () =>
      container.applyAxiosInterceptors(
        new ManagedWalletHttpService(
          {
            baseURL: container.apiUrlService.getBaseApiUrlFor(config.MANAGED_WALLET_NETWORK_ID),
            adapter: "fetch"
          },
          container.analyticsService
        ),
        {
          request: [withUserToken],
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
    logger: () => new LoggerService({ name: `app-${config.runtimeEnv}` }),
    urlService: () => UrlService,
    userTracker: () => new UserTracker()
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

export function withInterceptors<T extends Axios | AxiosInstance = AxiosInstance>(axios: T, interceptors?: Interceptors) {
  interceptors?.request?.forEach(interceptor => axios.interceptors.request.use(interceptor));
  interceptors?.response?.forEach(interceptor => axios.interceptors.response.use(interceptor));
  return axios;
}

type Interceptor<T> = (value: T) => T | Promise<T>;
interface Interceptors {
  request?: Array<Interceptor<InternalAxiosRequestConfig> | undefined>;
  response?: Array<Interceptor<AxiosResponse> | undefined>;
}
