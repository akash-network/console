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
exports.useBalances = useBalances;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var queryKeys_1 = require("./queryKeys");
function useBalances(address, options) {
    var _a = (0, ServicesProvider_1.useServices)(), walletBalancesService = _a.walletBalancesService, authzHttpService = _a.authzHttpService, chainApiHttpClient = _a.chainApiHttpClient;
    return (0, react_query_1.useQuery)(__assign(__assign({ queryKey: queryKeys_1.QueryKeys.getBalancesKey(address), queryFn: function () {
            if (!address)
                return null;
            return walletBalancesService.getBalances(address);
        } }, options), { enabled: (options === null || options === void 0 ? void 0 : options.enabled) !== false && !!address && authzHttpService.isReady && !chainApiHttpClient.isFallbackEnabled }));
}
