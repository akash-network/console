"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStripePricesQuery = useStripePricesQuery;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
function useStripePricesQuery(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.enabled, enabled = _c === void 0 ? true : _c;
    var stripeService = (0, ServicesProvider_1.useServices)().stripe;
    return (0, react_query_1.useQuery)({
        queryKey: ["StripePrices"],
        queryFn: function () { return stripeService.findPrices(); },
        enabled: enabled,
        initialData: [],
        select: function (data) { return data || []; }
    });
}
