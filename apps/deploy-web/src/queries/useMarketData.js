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
exports.useMarketData = useMarketData;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var apiUtils_1 = require("@src/utils/apiUtils");
var queryKeys_1 = require("./queryKeys");
function useMarketData(options) {
    var publicConsoleApiHttpClient = (0, ServicesProvider_1.useServices)().publicConsoleApiHttpClient;
    return (0, react_query_1.useQuery)(__assign({ queryKey: queryKeys_1.QueryKeys.getFinancialDataKey(), queryFn: function () { return publicConsoleApiHttpClient.get(apiUtils_1.ApiUrlService.marketData()).then(function (response) { return response.data; }); } }, options));
}
