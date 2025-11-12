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
exports.useBlock = useBlock;
exports.useBlocks = useBlocks;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var apiUtils_1 = require("@src/utils/apiUtils");
var queryKeys_1 = require("./queryKeys");
function useBlock(id, options) {
    if (options === void 0) { options = {}; }
    var chainApiHttpClient = (0, ServicesProvider_1.useServices)().chainApiHttpClient;
    return (0, react_query_1.useQuery)(__assign(__assign({ queryKey: queryKeys_1.QueryKeys.getBlockKey(id), queryFn: function () { return chainApiHttpClient.get(apiUtils_1.ApiUrlService.block("", id)).then(function (response) { return response.data; }); }, refetchInterval: false, refetchIntervalInBackground: false, refetchOnWindowFocus: false, refetchOnReconnect: false }, options), { enabled: options.enabled !== false && !!chainApiHttpClient.defaults.baseURL && !chainApiHttpClient.isFallbackEnabled }));
}
function useBlocks(limit, options) {
    var publicConsoleApiHttpClient = (0, ServicesProvider_1.useServices)().publicConsoleApiHttpClient;
    return (0, react_query_1.useQuery)(__assign({ queryKey: queryKeys_1.QueryKeys.getBlocksKey(limit), queryFn: function () { return publicConsoleApiHttpClient.get(apiUtils_1.ApiUrlService.blocks(limit)).then(function (response) { return response.data; }); } }, options));
}
