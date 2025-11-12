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
exports.USE_API_KEYS_DEPENDENCIES = void 0;
exports.useUserApiKeys = useUserApiKeys;
exports.useCreateApiKey = useCreateApiKey;
exports.useDeleteApiKey = useDeleteApiKey;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useUser_1 = require("@src/hooks/useUser");
var queryKeys_1 = require("./queryKeys");
exports.USE_API_KEYS_DEPENDENCIES = {
    useUser: useUser_1.useUser,
    useWallet: WalletProvider_1.useWallet
};
function useUserApiKeys(options, dependencies) {
    var _this = this;
    var _a;
    if (options === void 0) { options = {}; }
    if (dependencies === void 0) { dependencies = exports.USE_API_KEYS_DEPENDENCIES; }
    var user = dependencies.useUser().user;
    var _b = dependencies.useWallet(), isTrialing = _b.isTrialing, isManaged = _b.isManaged;
    var apiKey = (0, ServicesProvider_1.useServices)().apiKey;
    return (0, react_query_1.useQuery)(__assign({ queryKey: queryKeys_1.QueryKeys.getApiKeysKey((_a = user === null || user === void 0 ? void 0 : user.userId) !== null && _a !== void 0 ? _a : ""), queryFn: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, apiKey.getApiKeys()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        }); }); }, enabled: !!(user === null || user === void 0 ? void 0 : user.userId) && !isTrialing && isManaged, refetchInterval: 10000, retry: function (failureCount) { return failureCount < 5; }, retryDelay: 10000 }, options));
}
function useCreateApiKey(dependencies) {
    if (dependencies === void 0) { dependencies = exports.USE_API_KEYS_DEPENDENCIES; }
    var user = dependencies.useUser().user;
    var queryClient = (0, react_query_1.useQueryClient)();
    var apiKey = (0, ServicesProvider_1.useServices)().apiKey;
    return (0, react_query_1.useMutation)({
        mutationFn: function (name) {
            return apiKey.createApiKey({
                data: {
                    name: name
                }
            });
        },
        onSuccess: function (_response) {
            var _a;
            queryClient.setQueryData(queryKeys_1.QueryKeys.getApiKeysKey((_a = user === null || user === void 0 ? void 0 : user.userId) !== null && _a !== void 0 ? _a : ""), function (oldData) {
                if (!oldData)
                    return [_response];
                return __spreadArray(__spreadArray([], oldData, true), [_response], false);
            });
        }
    });
}
function useDeleteApiKey(id, onSuccess, dependencies) {
    if (dependencies === void 0) { dependencies = exports.USE_API_KEYS_DEPENDENCIES; }
    var user = dependencies.useUser().user;
    var queryClient = (0, react_query_1.useQueryClient)();
    var apiKey = (0, ServicesProvider_1.useServices)().apiKey;
    return (0, react_query_1.useMutation)({
        mutationFn: function () { return apiKey.deleteApiKey(id); },
        onSuccess: function () {
            var _a;
            queryClient.setQueryData(queryKeys_1.QueryKeys.getApiKeysKey((_a = user === null || user === void 0 ? void 0 : user.userId) !== null && _a !== void 0 ? _a : ""), function (oldData) {
                if (oldData === void 0) { oldData = []; }
                return oldData.filter(function (t) { return t.id !== id; });
            });
            onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();
        }
    });
}
