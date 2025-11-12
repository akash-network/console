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
exports.AutoTopUpSettingContainer = void 0;
var react_1 = require("react");
var AutoTopUpSetting_1 = require("@src/components/settings/AutoTopUpSetting/AutoTopUpSetting");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useAutoTopUpLimits_1 = require("@src/hooks/useAutoTopUpLimits");
var useAutoTopUpService_1 = require("@src/hooks/useAutoTopUpService");
var AutoTopUpSettingContainer = function () {
    var _a = (0, WalletProvider_1.useWallet)(), address = _a.address, signAndBroadcastTx = _a.signAndBroadcastTx;
    var _b = (0, useAutoTopUpLimits_1.useAutoTopUpLimits)(), fetch = _b.fetch, uaktFeeLimit = _b.uaktFeeLimit, usdcFeeLimit = _b.usdcFeeLimit, uaktDeploymentLimit = _b.uaktDeploymentLimit, usdcDeploymentLimit = _b.usdcDeploymentLimit, expiration = _b.expiration;
    var autoTopUpMessageService = (0, useAutoTopUpService_1.useAutoTopUpService)();
    (0, react_1.useEffect)(function () {
        fetch();
    }, []);
    var updateAllowancesAndGrants = (0, react_1.useCallback)(function (action, next) { return __awaiter(void 0, void 0, void 0, function () {
        var prev, messages;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    prev = {
                        uaktFeeLimit: uaktFeeLimit,
                        usdcFeeLimit: usdcFeeLimit,
                        uaktDeploymentLimit: uaktDeploymentLimit,
                        usdcDeploymentLimit: usdcDeploymentLimit,
                        expiration: expiration
                    };
                    messages = autoTopUpMessageService.collectMessages({
                        granter: address,
                        prev: prev,
                        next: action === "revoke-all" ? undefined : __assign(__assign({}, next), { expiration: new Date(next.expiration) })
                    });
                    if (!messages.length) return [3 /*break*/, 2];
                    return [4 /*yield*/, signAndBroadcastTx(messages)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [4 /*yield*/, fetch()];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [address, autoTopUpMessageService, expiration, fetch, signAndBroadcastTx, uaktDeploymentLimit, uaktFeeLimit, usdcDeploymentLimit, usdcFeeLimit]);
    return (<AutoTopUpSetting_1.AutoTopUpSetting onSubmit={updateAllowancesAndGrants} uaktFeeLimit={uaktFeeLimit} usdcFeeLimit={usdcFeeLimit} uaktDeploymentLimit={uaktDeploymentLimit} usdcDeploymentLimit={usdcDeploymentLimit} expiration={expiration}/>);
};
exports.AutoTopUpSettingContainer = AutoTopUpSettingContainer;
