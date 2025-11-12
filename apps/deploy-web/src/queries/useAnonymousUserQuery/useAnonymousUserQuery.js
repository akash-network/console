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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RETRY_AFTER_SECONDS = void 0;
exports.useAnonymousUserQuery = useAnonymousUserQuery;
var react_1 = require("react");
var http_sdk_1 = require("@akashnetwork/http-sdk");
var jotai_1 = require("jotai");
var utils_1 = require("jotai/utils");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useWhen_1 = require("@src/hooks/useWhen");
var userStateAtom = (0, jotai_1.atom)({
    isLoading: false
});
/** @private for tests only */
exports.DEFAULT_RETRY_AFTER_SECONDS = 60 * 60;
function useAnonymousUserQuery(id, options) {
    var _this = this;
    var store = (0, jotai_1.useStore)();
    var _a = (0, ServicesProvider_1.useServices)(), userService = _a.user, errorHandler = _a.errorHandler;
    var userState = (0, jotai_1.useAtom)(userStateAtom)[0];
    var fetchAnonymousUser = (0, utils_1.useAtomCallback)((0, react_1.useCallback)(function (get, set) { return __awaiter(_this, void 0, void 0, function () {
        var _a, fetched, rest, token, error_1, retryAfterInSeconds;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (get(userStateAtom).isLoading)
                        return [2 /*return*/];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    set(userStateAtom, { isLoading: true });
                    return [4 /*yield*/, userService.getOrCreateAnonymousUser(id)];
                case 2:
                    _a = _d.sent(), fetched = _a.data, rest = __rest(_a, ["data"]);
                    token = "token" in rest ? rest.token : undefined;
                    set(userStateAtom, { user: fetched, token: token, isLoading: false });
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _d.sent();
                    retryAfterInSeconds = (0, http_sdk_1.isHttpError)(error_1) && ((_b = error_1.response) === null || _b === void 0 ? void 0 : _b.status) === 429 ? ((_c = error_1.response.data) === null || _c === void 0 ? void 0 : _c.retryAfter) || exports.DEFAULT_RETRY_AFTER_SECONDS : 10;
                    set(userStateAtom, { isLoading: false, error: error_1, retryAfter: new Date(Date.now() + retryAfterInSeconds * 1000) });
                    errorHandler.reportError({ error: error_1, tags: { category: "anonymousUserQuery" } });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [id, userService, errorHandler]), { store: store });
    (0, useWhen_1.useWhen)((options === null || options === void 0 ? void 0 : options.enabled) && !userState.user && !userState.isLoading && (!userState.retryAfter || userState.retryAfter.getTime() < Date.now()), fetchAnonymousUser);
    return userState;
}
