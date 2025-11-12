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
Object.defineProperty(exports, "__esModule", { value: true });
exports.services = void 0;
var notifications_1 = require("@akashnetwork/react-query-sdk/notifications");
var nextjs_auth0_1 = require("@auth0/nextjs-auth0");
var react_1 = require("@openapi-qraft/react");
var unleashModule = require("@unleash/nextjs");
var http_proxy_1 = require("http-proxy");
var server_env_config_1 = require("@src/config/server-env.config");
var api_url_service_1 = require("../api-url/api-url.service");
var client_ip_forwarding_interceptor_1 = require("../client-ip-forwarding/client-ip-forwarding.interceptor");
var createContainer_1 = require("../container/createContainer");
var feature_flag_service_1 = require("../feature-flag/feature-flag.service");
var app_di_container_1 = require("./app-di-container");
var rootContainer = (0, app_di_container_1.createAppRootContainer)(__assign(__assign({}, server_env_config_1.serverEnvConfig), { runtimeEnv: "nodejs", BASE_PROVIDER_PROXY_URL: server_env_config_1.serverEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL, MANAGED_WALLET_NETWORK_ID: server_env_config_1.serverEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID, globalRequestMiddleware: client_ip_forwarding_interceptor_1.clientIpForwardingInterceptor, apiUrlService: function () { return new api_url_service_1.ApiUrlService(server_env_config_1.serverEnvConfig); } }));
exports.services = (0, createContainer_1.createChildContainer)(rootContainer, {
    getSession: function () { return nextjs_auth0_1.getSession; },
    httpProxy: function () { return ({ createProxyServer: http_proxy_1.default.createProxyServer }); },
    featureFlagService: function () { return new feature_flag_service_1.FeatureFlagService(unleashModule, server_env_config_1.serverEnvConfig); },
    notificationsApi: function () {
        return (0, notifications_1.createAPIClient)({
            requestFn: react_1.requestFn,
            baseUrl: server_env_config_1.serverEnvConfig.BASE_API_MAINNET_URL
        });
    },
    config: function () { return server_env_config_1.serverEnvConfig; },
    consoleApiHttpClient: function () { return exports.services.applyAxiosInterceptors(exports.services.createAxios()); }
});
