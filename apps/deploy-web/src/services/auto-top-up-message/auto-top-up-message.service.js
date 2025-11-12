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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoTopUpMessageService = void 0;
var browser_env_config_1 = require("@src/config/browser-env.config");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var AutoTopUpMessageService = /** @class */ (function () {
    function AutoTopUpMessageService(usdcDenom) {
        this.usdcDenom = usdcDenom;
    }
    AutoTopUpMessageService.prototype.collectMessages = function (options) {
        var uaktSides = {
            granter: options.granter,
            grantee: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS
        };
        var usdcSides = {
            granter: options.granter,
            grantee: browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS
        };
        return __spreadArray(__spreadArray(__spreadArray(__spreadArray([], this.collectFeeMessages(__assign(__assign({}, uaktSides), { prev: {
                limit: options.prev.uaktFeeLimit,
                expiration: options.prev.expiration
            }, next: options.next && {
                limit: options.next.uaktFeeLimit,
                expiration: options.next.expiration
            } })), true), this.collectFeeMessages(__assign(__assign({}, usdcSides), { prev: {
                limit: options.prev.usdcFeeLimit,
                expiration: options.prev.expiration
            }, next: options.next && {
                limit: options.next.usdcFeeLimit,
                expiration: options.next.expiration
            } })), true), this.collectDeploymentMessages(__assign(__assign({}, uaktSides), { denom: "uakt", prev: {
                limit: options.prev.uaktDeploymentLimit,
                expiration: options.prev.expiration
            }, next: options.next && {
                limit: options.next.uaktDeploymentLimit,
                expiration: options.next.expiration
            } })), true), this.collectDeploymentMessages(__assign(__assign({}, usdcSides), { denom: this.usdcDenom, prev: {
                limit: options.prev.usdcDeploymentLimit,
                expiration: options.prev.expiration
            }, next: options.next && {
                limit: options.next.usdcDeploymentLimit,
                expiration: options.next.expiration
            } })), true);
    };
    AutoTopUpMessageService.prototype.collectFeeMessages = function (options) {
        var _a, _b, _c, _d, _e, _f, _g;
        var messages = [];
        var isSameExpiration = ((_b = (_a = options.prev) === null || _a === void 0 ? void 0 : _a.expiration) === null || _b === void 0 ? void 0 : _b.getTime()) === ((_c = options.next) === null || _c === void 0 ? void 0 : _c.expiration.getTime());
        var isSameLimit = ((_d = options.prev) === null || _d === void 0 ? void 0 : _d.limit) === ((_e = options.next) === null || _e === void 0 ? void 0 : _e.limit);
        if (isSameExpiration && isSameLimit) {
            return messages;
        }
        if (typeof ((_f = options.prev) === null || _f === void 0 ? void 0 : _f.limit) !== "undefined") {
            messages.push(TransactionMessageData_1.TransactionMessageData.getRevokeAllowanceMsg(options.granter, options.grantee));
        }
        if ((_g = options.next) === null || _g === void 0 ? void 0 : _g.limit) {
            messages.push(TransactionMessageData_1.TransactionMessageData.getGrantBasicAllowanceMsg(options.granter, options.grantee, options.next.limit, "uakt", options.next.expiration));
        }
        return messages;
    };
    AutoTopUpMessageService.prototype.collectDeploymentMessages = function (options) {
        var _a, _b, _c, _d, _e, _f, _g;
        var messages = [];
        var isSameExpiration = ((_b = (_a = options.prev) === null || _a === void 0 ? void 0 : _a.expiration) === null || _b === void 0 ? void 0 : _b.getTime()) === ((_c = options.next) === null || _c === void 0 ? void 0 : _c.expiration.getTime());
        var isSameLimit = ((_d = options.prev) === null || _d === void 0 ? void 0 : _d.limit) === ((_e = options.next) === null || _e === void 0 ? void 0 : _e.limit);
        if (isSameExpiration && isSameLimit) {
            return messages;
        }
        if ((_f = options.next) === null || _f === void 0 ? void 0 : _f.limit) {
            messages.push(TransactionMessageData_1.TransactionMessageData.getGrantMsg(options.granter, options.grantee, options.next.limit, options.next.expiration, options.denom || "uakt"));
        }
        else if (typeof ((_g = options.prev) === null || _g === void 0 ? void 0 : _g.limit) !== "undefined") {
            messages.push(TransactionMessageData_1.TransactionMessageData.getRevokeDepositMsg(options.granter, options.grantee));
        }
        return messages;
    };
    return AutoTopUpMessageService;
}());
exports.AutoTopUpMessageService = AutoTopUpMessageService;
