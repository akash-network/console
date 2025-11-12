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
exports.ChainParamProvider = void 0;
exports.useChainParam = useChainParam;
var react_1 = require("react");
var react_2 = require("react");
var denom_config_1 = require("@src/config/denom.config");
var useDenom_1 = require("@src/hooks/useDenom");
var useSaveSettings_1 = require("@src/queries/useSaveSettings");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var SettingsProvider_1 = require("../SettingsProvider");
var ChainParamContext = react_1.default.createContext({});
var ChainParamProvider = function (_a) {
    var _b, _c;
    var children = _a.children;
    var _d = (0, SettingsProvider_1.useSettings)(), isSettingsInit = _d.isSettingsInit, settings = _d.settings;
    var _e = (0, useSaveSettings_1.useDepositParams)({ enabled: false }), depositParams = _e.data, getDepositParams = _e.refetch;
    var usdcDenom = (0, useDenom_1.useUsdcDenom)();
    var aktMinDeposit = depositParams ? (0, priceUtils_1.uaktToAKT)(parseFloat(((_b = depositParams.find(function (x) { return x.denom === denom_config_1.UAKT_DENOM; })) === null || _b === void 0 ? void 0 : _b.amount) || "") || 0) : 0;
    var usdcMinDeposit = depositParams ? (0, mathHelpers_1.udenomToDenom)(parseFloat(((_c = depositParams.find(function (x) { return x.denom === usdcDenom; })) === null || _c === void 0 ? void 0 : _c.amount) || "") || 0) : 0;
    var minDeposit = { akt: aktMinDeposit, usdc: usdcMinDeposit };
    (0, react_2.useEffect)(function () {
        if (isSettingsInit && !depositParams && !settings.isBlockchainDown) {
            getDepositParams();
        }
    }, [isSettingsInit, depositParams, settings.isBlockchainDown]);
    return <ChainParamContext.Provider value={{ minDeposit: minDeposit }}>{children}</ChainParamContext.Provider>;
};
exports.ChainParamProvider = ChainParamProvider;
// Hook
function useChainParam() {
    return __assign({}, react_1.default.useContext(ChainParamContext));
}
