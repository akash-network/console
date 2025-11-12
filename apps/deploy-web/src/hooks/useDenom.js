"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSdlDenoms = exports.getUsdcDenom = exports.useUsdcDenom = void 0;
var denom_config_1 = require("@src/config/denom.config");
var networkStore_1 = require("@src/store/networkStore");
var useUsdcDenom = function () {
    return denom_config_1.USDC_IBC_DENOMS[networkStore_1.default.selectedNetworkId];
};
exports.useUsdcDenom = useUsdcDenom;
var getUsdcDenom = function () {
    return denom_config_1.USDC_IBC_DENOMS[networkStore_1.default.selectedNetworkId];
};
exports.getUsdcDenom = getUsdcDenom;
var useSdlDenoms = function () {
    var usdcDenom = (0, exports.useUsdcDenom)();
    return [
        { id: "uakt", label: "uAKT", tokenLabel: "AKT", value: "uakt" },
        { id: "uusdc", label: "uUSDC", tokenLabel: "USDC", value: usdcDenom }
    ];
};
exports.useSdlDenoms = useSdlDenoms;
