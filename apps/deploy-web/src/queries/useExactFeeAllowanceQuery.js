"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useExactFeeAllowanceQuery = useExactFeeAllowanceQuery;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var queryKeys_1 = require("@src/queries/queryKeys");
function useExactFeeAllowanceQuery(granter, grantee, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.enabled, enabled = _c === void 0 ? true : _c;
    var authzHttpService = (0, ServicesProvider_1.useServices)().authzHttpService;
    return (0, react_query_1.useQuery)({
        queryKey: queryKeys_1.QueryKeys.getFeeAllowancesKey(granter, grantee),
        queryFn: function () { return authzHttpService.getFeeAllowanceForGranterAndGrantee(granter, grantee); },
        enabled: enabled
    });
}
