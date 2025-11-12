"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAutoTopUpLimits = void 0;
var react_1 = require("react");
var date_fns_1 = require("date-fns");
var invokeMap_1 = require("lodash/invokeMap");
var browser_env_config_1 = require("@src/config/browser-env.config");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useExactDeploymentGrantsQuery_1 = require("@src/queries/useExactDeploymentGrantsQuery");
var useExactFeeAllowanceQuery_1 = require("@src/queries/useExactFeeAllowanceQuery");
var useAutoTopUpLimits = function () {
    var _a, _b, _c, _d;
    var address = (0, WalletProvider_1.useWallet)().address;
    var uaktFeeAllowance = (0, useExactFeeAllowanceQuery_1.useExactFeeAllowanceQuery)(address, browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS, { enabled: false });
    var uaktDeploymentGrant = (0, useExactDeploymentGrantsQuery_1.useExactDeploymentGrantsQuery)(address, browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS, { enabled: false });
    var usdcFeeAllowance = (0, useExactFeeAllowanceQuery_1.useExactFeeAllowanceQuery)(address, browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS, { enabled: false });
    var usdcDeploymentGrant = (0, useExactDeploymentGrantsQuery_1.useExactDeploymentGrantsQuery)(address, browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS, { enabled: false });
    var uaktFeeLimit = (0, react_1.useMemo)(function () { return extractFeeLimit(uaktFeeAllowance.data); }, [uaktFeeAllowance.data]);
    var usdcFeeLimit = (0, react_1.useMemo)(function () { return extractFeeLimit(usdcFeeAllowance.data); }, [usdcFeeAllowance.data]);
    var uaktDeploymentLimit = (0, react_1.useMemo)(function () { return extractDeploymentLimit(uaktDeploymentGrant.data); }, [uaktDeploymentGrant.data]);
    var usdcDeploymentLimit = (0, react_1.useMemo)(function () { return extractDeploymentLimit(usdcDeploymentGrant.data); }, [usdcDeploymentGrant.data]);
    var earliestExpiration = (0, react_1.useMemo)(function () {
        var _a, _b, _c, _d;
        var expirations = [
            (_a = uaktFeeAllowance.data) === null || _a === void 0 ? void 0 : _a.allowance.expiration,
            (_b = uaktDeploymentGrant.data) === null || _b === void 0 ? void 0 : _b.expiration,
            (_c = usdcFeeAllowance.data) === null || _c === void 0 ? void 0 : _c.allowance.expiration,
            (_d = usdcDeploymentGrant.data) === null || _d === void 0 ? void 0 : _d.expiration
        ]
            .filter(Boolean)
            .map(function (expiration) { return new Date(expiration); });
        if (!expirations.length) {
            return undefined;
        }
        return expirations.reduce(function (acc, date) {
            if (date < acc) {
                return date;
            }
            return acc;
        });
    }, [
        (_a = uaktDeploymentGrant.data) === null || _a === void 0 ? void 0 : _a.expiration,
        (_b = uaktFeeAllowance.data) === null || _b === void 0 ? void 0 : _b.allowance.expiration,
        (_c = usdcDeploymentGrant.data) === null || _c === void 0 ? void 0 : _c.expiration,
        (_d = usdcFeeAllowance.data) === null || _d === void 0 ? void 0 : _d.allowance.expiration
    ]);
    var fetch = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, Promise.all([(0, invokeMap_1.default)([uaktFeeAllowance, uaktDeploymentGrant, usdcFeeAllowance, usdcDeploymentGrant], "refetch")])];
            case 1: return [2 /*return*/, _a.sent()];
        }
    }); }); }, [uaktFeeAllowance, uaktDeploymentGrant, usdcFeeAllowance, usdcDeploymentGrant]);
    return {
        fetch: fetch,
        uaktFeeLimit: uaktFeeLimit,
        usdcFeeLimit: usdcFeeLimit,
        uaktDeploymentLimit: uaktDeploymentLimit,
        usdcDeploymentLimit: usdcDeploymentLimit,
        expiration: earliestExpiration
    };
};
exports.useAutoTopUpLimits = useAutoTopUpLimits;
function extractDeploymentLimit(deploymentGrant) {
    if (!deploymentGrant) {
        return undefined;
    }
    var isExpired = !(0, date_fns_1.isFuture)(new Date(deploymentGrant.expiration));
    if (isExpired) {
        return undefined;
    }
    return parseFloat(deploymentGrant === null || deploymentGrant === void 0 ? void 0 : deploymentGrant.authorization.spend_limit.amount);
}
function extractFeeLimit(feeLimit) {
    if (!feeLimit) {
        return undefined;
    }
    var isExpired = !(0, date_fns_1.isFuture)(new Date(feeLimit.allowance.expiration));
    if (isExpired) {
        return undefined;
    }
    return parseFloat(feeLimit.allowance.spend_limit[0].amount);
}
