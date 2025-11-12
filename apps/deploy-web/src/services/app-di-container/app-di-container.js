"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppRootContainer = void 0;
exports.withInterceptors = withInterceptors;
var web_1 = require("@akashnetwork/chain-sdk/web");
var http_sdk_1 = require("@akashnetwork/http-sdk");
var stripe_service_1 = require("@akashnetwork/http-sdk/src/stripe/stripe.service");
var logging_1 = require("@akashnetwork/logging");
var nextjs_1 = require("@sentry/nextjs");
var react_query_1 = require("@tanstack/react-query");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var customRegistry_1 = require("@src/utils/customRegistry");
var urlUtils_1 = require("@src/utils/urlUtils");
var interceptors_1 = require("../auth/auth/interceptors");
var createContainer_1 = require("../container/createContainer");
var error_handler_service_1 = require("../error-handler/error-handler.service");
var managed_wallet_http_service_1 = require("../managed-wallet-http/managed-wallet-http.service");
var provider_proxy_service_1 = require("../provider-proxy/provider-proxy.service");
var stripe_service_2 = require("../stripe/stripe.service");
var user_tracker_service_1 = require("../user-tracker/user-tracker.service");
var createAppRootContainer = function (config) {
    var apiConfig = { baseURL: config.BASE_API_MAINNET_URL, adapter: "fetch" };
    var container = (0, createContainer_1.createContainer)({
        getTraceData: function () { return nextjs_1.getTraceData; },
        applyAxiosInterceptors: function () {
            var otelInterceptor = function (config) {
                var traceData = container.getTraceData();
                if (traceData === null || traceData === void 0 ? void 0 : traceData["sentry-trace"])
                    config.headers.set("Traceparent", traceData["sentry-trace"]);
                if (traceData === null || traceData === void 0 ? void 0 : traceData.baggage)
                    config.headers.set("Baggage", traceData.baggage);
                return config;
            };
            return function (axiosInstance, interceptors) {
                return withInterceptors(axiosInstance, {
                    request: __spreadArray([config.globalRequestMiddleware, otelInterceptor], ((interceptors === null || interceptors === void 0 ? void 0 : interceptors.request) || []), true),
                    response: __spreadArray([], ((interceptors === null || interceptors === void 0 ? void 0 : interceptors.response) || []), true)
                });
            };
        },
        user: function () {
            return container.applyAxiosInterceptors(new http_sdk_1.UserHttpService(apiConfig), {
                request: [interceptors_1.withUserToken],
                response: [
                    function (response) {
                        var _a;
                        if (((_a = response.config.url) === null || _a === void 0 ? void 0 : _a.startsWith("/v1/anonymous-users")) && response.config.method === "post" && response.status === 200) {
                            container.analyticsService.track("anonymous_user_created", { category: "user", label: "Anonymous User Created" });
                        }
                        return response;
                    }
                ]
            });
        },
        stripe: function () {
            return container.applyAxiosInterceptors(new stripe_service_1.StripeService(apiConfig), {
                request: [interceptors_1.withUserToken]
            });
        },
        stripeService: function () { return new stripe_service_2.StripeService(); },
        tx: function () {
            return container.applyAxiosInterceptors(new http_sdk_1.TxHttpService(customRegistry_1.registry, apiConfig), {
                request: [interceptors_1.withUserToken]
            });
        },
        template: function () { return container.applyAxiosInterceptors(new http_sdk_1.TemplateHttpService(apiConfig)); },
        usage: function () {
            return container.applyAxiosInterceptors(new http_sdk_1.UsageHttpService(apiConfig), {
                request: [interceptors_1.withUserToken]
            });
        },
        auth: function () {
            return container.applyAxiosInterceptors(new http_sdk_1.AuthHttpService(apiConfig), {
                request: [interceptors_1.withUserToken]
            });
        },
        providerProxy: function () {
            return new provider_proxy_service_1.ProviderProxyService(container.applyAxiosInterceptors(container.createAxios({ baseURL: config.BASE_PROVIDER_PROXY_URL })), container.logger, function () { return new WebSocket(config.BASE_PROVIDER_PROXY_URL.replace(/^http/, "ws")); });
        },
        deploymentSetting: function () {
            return container.applyAxiosInterceptors(new http_sdk_1.DeploymentSettingHttpService(apiConfig), {
                request: [interceptors_1.withUserToken]
            });
        },
        apiKey: function () {
            return container.applyAxiosInterceptors(new http_sdk_1.ApiKeyHttpService(apiConfig), {
                request: [interceptors_1.withUserToken]
            });
        },
        externalApiHttpClient: function () {
            return container.createAxios({
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                }
            });
        },
        createAxios: function () {
            return function (options) {
                return withInterceptors((0, http_sdk_1.createHttpClient)(__assign({ adapter: "fetch" }, options)), {
                    request: [config.globalRequestMiddleware]
                });
            };
        },
        certificateManager: function () { return web_1.certificateManager; },
        analyticsService: function () { return analytics_service_1.analyticsService; },
        apiUrlService: config.apiUrlService,
        managedWalletService: function () {
            return container.applyAxiosInterceptors(new managed_wallet_http_service_1.ManagedWalletHttpService({
                baseURL: container.apiUrlService.getBaseApiUrlFor(config.MANAGED_WALLET_NETWORK_ID),
                adapter: "fetch"
            }, container.analyticsService), {
                request: [interceptors_1.withUserToken],
                response: [
                    function (response) {
                        if (response.config.url === "v1/start-trial" && response.config.method === "post" && response.status === 200) {
                            container.analyticsService.track("trial_started", { category: "billing", label: "Trial Started" });
                        }
                        return response;
                    }
                ]
            });
        },
        queryClient: function () {
            return new react_query_1.QueryClient({
                queryCache: new react_query_1.QueryCache({
                    onError: function (error) { return container.errorHandler.reportError({ error: error }); }
                }),
                mutationCache: new react_query_1.MutationCache({
                    onError: function (error) { return container.errorHandler.reportError({ error: error }); }
                })
            });
        },
        errorHandler: function () { return new error_handler_service_1.ErrorHandlerService(container.logger); },
        logger: function () { return new logging_1.LoggerService({ name: "app-".concat(config.runtimeEnv) }); },
        urlService: function () { return urlUtils_1.UrlService; },
        userTracker: function () { return new user_tracker_service_1.UserTracker(); }
    });
    return container;
};
exports.createAppRootContainer = createAppRootContainer;
function withInterceptors(axios, interceptors) {
    var _a, _b;
    (_a = interceptors === null || interceptors === void 0 ? void 0 : interceptors.request) === null || _a === void 0 ? void 0 : _a.forEach(function (interceptor) { return axios.interceptors.request.use(interceptor); });
    (_b = interceptors === null || interceptors === void 0 ? void 0 : interceptors.response) === null || _b === void 0 ? void 0 : _b.forEach(function (interceptor) { return axios.interceptors.response.use(interceptor); });
    return axios;
}
