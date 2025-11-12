"use strict";
"use client";
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
exports.PricingProvider = void 0;
exports.usePricing = usePricing;
var react_1 = require("react");
var denom_config_1 = require("@src/config/denom.config");
var useDenom_1 = require("@src/hooks/useDenom");
var queries_1 = require("@src/queries");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var PricingProviderContext = react_1.default.createContext({});
var PricingProvider = function (_a) {
    var children = _a.children;
    var _b = (0, queries_1.useMarketData)({ refetchInterval: 60000 }), marketData = _b.data, isLoading = _b.isLoading;
    var usdcIbcDenom = (0, useDenom_1.useUsdcDenom)();
    function uaktToUSD(amount) {
        if (!marketData)
            return null;
        return (0, mathHelpers_1.roundDecimal)((amount * marketData.price) / 1000000, 2);
    }
    function aktToUSD(amount) {
        if (!marketData)
            return null;
        return (0, mathHelpers_1.roundDecimal)(amount * marketData.price, 2);
    }
    function usdToAkt(amount) {
        if (!marketData)
            return null;
        return (0, mathHelpers_1.roundDecimal)(amount / marketData.price, 2);
    }
    var getPriceForDenom = function (denom) {
        switch (denom) {
            case denom_config_1.UAKT_DENOM:
                return (marketData === null || marketData === void 0 ? void 0 : marketData.price) || 0;
            case usdcIbcDenom:
                return 1; // TODO Get price from API
            default:
                return 0;
        }
    };
    var udenomToUsd = (0, react_1.useCallback)(function (amount, denom) {
        var value = 0;
        var parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
        if (denom === denom_config_1.UAKT_DENOM) {
            value = (0, priceUtils_1.uaktToAKT)(parsedAmount, 6) * ((marketData === null || marketData === void 0 ? void 0 : marketData.price) || 0);
        }
        else if (denom === usdcIbcDenom || denom === "usdc") {
            value = (0, mathHelpers_1.udenomToDenom)(parsedAmount, 6);
        }
        return value;
    }, [marketData === null || marketData === void 0 ? void 0 : marketData.price, usdcIbcDenom]);
    return (<PricingProviderContext.Provider value={{ isLoaded: !!marketData, uaktToUSD: uaktToUSD, aktToUSD: aktToUSD, usdToAkt: usdToAkt, price: marketData === null || marketData === void 0 ? void 0 : marketData.price, isLoading: isLoading, getPriceForDenom: getPriceForDenom, udenomToUsd: udenomToUsd }}>
      {children}
    </PricingProviderContext.Provider>);
};
exports.PricingProvider = PricingProvider;
// Hook
function usePricing() {
    return __assign({}, react_1.default.useContext(PricingProviderContext));
}
