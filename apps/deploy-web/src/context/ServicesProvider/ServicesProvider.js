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
exports.ServicesProvider = void 0;
exports.useServices = useServices;
var react_1 = require("react");
var http_sdk_1 = require("@akashnetwork/http-sdk");
var app_di_container_1 = require("@src/services/app-di-container/app-di-container");
var browser_di_container_1 = require("@src/services/app-di-container/browser-di-container");
var createContainer_1 = require("@src/services/container/createContainer");
var createFallbackableHttpClient_1 = require("@src/services/createFallbackableHttpClient/createFallbackableHttpClient");
var wallet_balances_service_1 = require("@src/services/wallet-balances/wallet-balances.service");
var SettingsProviderContext_1 = require("../SettingsProvider/SettingsProviderContext");
var ServicesContext_1 = require("./ServicesContext");
var ServicesProvider = function (_a) {
    var children = _a.children, services = _a.services;
    var settingsState = (0, SettingsProviderContext_1.useSettings)();
    var childContainer = createAppContainer(settingsState, services);
    return <ServicesContext_1.ServicesContext.Provider value={childContainer}>{children}</ServicesContext_1.ServicesContext.Provider>;
};
exports.ServicesProvider = ServicesProvider;
function useServices() {
    return (0, react_1.useContext)(ServicesContext_1.ServicesContext);
}
var neverResolvedPromise = new Promise(function () { });
function createAppContainer(settingsState, services) {
    var di = (0, createContainer_1.createChildContainer)(browser_di_container_1.services, __assign({ authzHttpService: function () { return new http_sdk_1.AuthzHttpService(di.chainApiHttpClient); }, walletBalancesService: function () { return new wallet_balances_service_1.WalletBalancesService(di.authzHttpService, di.chainApiHttpClient, di.appConfig.NEXT_PUBLIC_MASTER_WALLET_ADDRESS); }, certificatesService: function () { return new http_sdk_1.CertificatesService(di.chainApiHttpClient); }, chainApiHttpClient: function () {
            var _a, _b;
            var inflightPingRequest;
            // keep track of the blockchain down status to make it instant
            // settings from useSettings hook is reactive and updated with a delay, according to react rendering cycle
            var isBlockchainDown = (_a = settingsState.settings) === null || _a === void 0 ? void 0 : _a.isBlockchainDown;
            var chainApiHttpClient = (0, app_di_container_1.withInterceptors)((0, createFallbackableHttpClient_1.createFallbackableHttpClient)(browser_di_container_1.services.createAxios, browser_di_container_1.services.fallbackChainApiHttpClient, {
                baseURL: (_b = settingsState.settings) === null || _b === void 0 ? void 0 : _b.apiEndpoint,
                shouldFallback: function () { var _a; return isBlockchainDown || !!((_a = settingsState.settings) === null || _a === void 0 ? void 0 : _a.isBlockchainDown); },
                onUnavailableError: function (error) {
                    if (isBlockchainDown)
                        return;
                    // ensure blockchain is really unavailable and it's not an issue with some endpoint
                    inflightPingRequest !== null && inflightPingRequest !== void 0 ? inflightPingRequest : (inflightPingRequest = chainApiHttpClient
                        .get("/cosmos/base/tendermint/v1beta1/node_info", { adapter: "fetch", timeout: 5000 })
                        .then(function () { return ({ isBlockchainDown: false }); })
                        .catch(function () {
                        if (isBlockchainDown)
                            return { isBlockchainDown: true };
                        isBlockchainDown = true;
                        settingsState.setSettings(function (prev) { return (__assign(__assign({}, prev), { isBlockchainDown: true })); });
                        return { isBlockchainDown: true };
                    })
                        .finally(function () {
                        setTimeout(function () {
                            inflightPingRequest = undefined;
                        }, 10000); // keep ping result in cache for few seconds to handle delayed requests
                    }));
                    return inflightPingRequest.then(function (result) {
                        if (!result.isBlockchainDown) {
                            // if blockchain is available, then we have an issue wit some endpoint
                            // and want the original request to fail and NOT fallback to fallbackChainApiHttpClient
                            return Promise.reject(error);
                        }
                    });
                },
                onSuccess: function () {
                    if (isBlockchainDown) {
                        settingsState.refreshNodeStatuses();
                    }
                }
            }), {
                request: [function (config) { return (config.baseURL ? config : neverResolvedPromise); }]
            });
            return chainApiHttpClient;
        } }, services));
    return di;
}
