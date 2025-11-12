"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.services = void 0;
var notifications_1 = require("@akashnetwork/react-query-sdk/notifications");
var react_1 = require("@openapi-qraft/react");
var browser_env_config_1 = require("@src/config/browser-env.config");
var api_url_service_1 = require("@src/services/api-url/api-url.service");
var networkStore_1 = require("@src/store/networkStore");
var walletUtils = require("@src/utils/walletUtils");
var auth_service_1 = require("../auth/auth/auth.service");
var interceptors_1 = require("../auth/auth/interceptors");
var createContainer_1 = require("../container/createContainer");
var deployment_storage_service_1 = require("../deployment-storage/deployment-storage.service");
var bitbucket_http_service_1 = require("../remote-deploy/bitbucket-http.service");
var github_http_service_1 = require("../remote-deploy/github-http.service");
var gitlab_http_service_1 = require("../remote-deploy/gitlab-http.service");
var app_di_container_1 = require("./app-di-container");
var rootContainer = (0, app_di_container_1.createAppRootContainer)({
    runtimeEnv: "browser",
    BASE_API_MAINNET_URL: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL,
    BASE_PROVIDER_PROXY_URL: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_PROVIDER_PROXY_URL,
    MANAGED_WALLET_NETWORK_ID: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID,
    apiUrlService: function () { return new api_url_service_1.ApiUrlService(browser_env_config_1.browserEnvConfig); }
});
exports.services = (0, createContainer_1.createChildContainer)(rootContainer, {
    notificationsApi: function () {
        return (0, notifications_1.createAPIClient)({
            requestFn: react_1.requestFn,
            baseUrl: "/api/proxy",
            queryClient: exports.services.queryClient
        });
    },
    githubService: function () { return new github_http_service_1.GitHubService(exports.services.internalApiHttpClient, exports.services.createAxios); },
    bitbucketService: function () { return new bitbucket_http_service_1.BitbucketService(exports.services.internalApiHttpClient, exports.services.createAxios); },
    gitlabService: function () { return new gitlab_http_service_1.GitLabService(exports.services.internalApiHttpClient, exports.services.createAxios); },
    internalApiHttpClient: function () {
        return (0, app_di_container_1.withInterceptors)(exports.services.createAxios(), {
            request: [interceptors_1.withAnonymousUserToken]
        });
    },
    consoleApiHttpClient: function () {
        return exports.services.applyAxiosInterceptors(exports.services.createAxios({ baseURL: exports.services.appConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL }), {
            request: [interceptors_1.withUserToken]
        });
    },
    /** TODO: https://github.com/akash-network/console/issues/1720 */
    publicConsoleApiHttpClient: function () { return exports.services.applyAxiosInterceptors(exports.services.createAxios()); },
    fallbackChainApiHttpClient: function () {
        return exports.services.applyAxiosInterceptors(exports.services.createAxios(), {
            request: [
                function (config) {
                    config.baseURL = exports.services.apiUrlService.getBaseApiUrlFor(exports.services.networkStore.selectedNetworkId);
                    return config;
                }
            ]
        });
    },
    networkStore: function () { return networkStore_1.default; },
    appConfig: function () { return browser_env_config_1.browserEnvConfig; },
    authService: function () { return new auth_service_1.AuthService(exports.services.urlService, exports.services.internalApiHttpClient); },
    storedWalletsService: function () { return walletUtils; },
    deploymentLocalStorage: function () { return new deployment_storage_service_1.DeploymentStorageService(localStorage, exports.services.networkStore); },
    windowLocation: function () { return window.location; },
    windowHistory: function () { return window.history; }
});
