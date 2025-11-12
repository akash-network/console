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
exports.useScopedFetchProviderUrl = useScopedFetchProviderUrl;
var react_1 = require("react");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var networkStore_1 = require("@src/store/networkStore");
function useScopedFetchProviderUrl(provider) {
    var chainNetwork = networkStore_1.default.useSelectedNetworkId();
    var providerProxy = (0, ServicesProvider_1.useServices)().providerProxy;
    return (0, react_1.useCallback)(function (url, options) {
        if (!provider)
            return new Promise(function () { });
        return providerProxy.request(url, __assign(__assign({}, options), { chainNetwork: chainNetwork, providerIdentity: provider }));
    }, [provider === null || provider === void 0 ? void 0 : provider.hostUri, provider === null || provider === void 0 ? void 0 : provider.owner, chainNetwork]);
}
