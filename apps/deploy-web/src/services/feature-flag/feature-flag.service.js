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
exports.FeatureFlagService = void 0;
var FeatureFlagService = /** @class */ (function () {
    function FeatureFlagService(unleash, config) {
        this.unleash = unleash;
        this.config = config;
        this.UNLEASH_COOKIE_KEY = "unleash-session-id=";
    }
    FeatureFlagService.prototype.getFlag = function (name, context) {
        return __awaiter(this, void 0, void 0, function () {
            var definitions, toggles, flags;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.config.NEXT_PUBLIC_UNLEASH_ENABLE_ALL)
                            return [2 /*return*/, true];
                        return [4 /*yield*/, this.unleash.getDefinitions({
                                fetchOptions: { next: { revalidate: 15 } }
                            })];
                    case 1:
                        definitions = _a.sent();
                        toggles = this.unleash.evaluateFlags(definitions, context).toggles;
                        flags = this.unleash.flagsClient(toggles);
                        return [2 /*return*/, flags.isEnabled(name)];
                }
            });
        });
    };
    FeatureFlagService.prototype.extractSessionId = function (ctx) {
        var _this = this;
        var _a;
        var cookies = (_a = ctx.req.headers.cookie) === null || _a === void 0 ? void 0 : _a.split(";").map(function (c) { return c.trim(); });
        var unleashCookie = cookies === null || cookies === void 0 ? void 0 : cookies.find(function (c) { return c.startsWith(_this.UNLEASH_COOKIE_KEY); });
        return unleashCookie === null || unleashCookie === void 0 ? void 0 : unleashCookie.replace(this.UNLEASH_COOKIE_KEY, "");
    };
    FeatureFlagService.prototype.isEnabledForCtx = function (name_1, ctx_1) {
        return __awaiter(this, arguments, void 0, function (name, ctx, extraContext) {
            var sessionId;
            if (extraContext === void 0) { extraContext = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.config.NEXT_PUBLIC_UNLEASH_ENABLE_ALL)
                            return [2 /*return*/, true];
                        sessionId = this.extractSessionId(ctx);
                        return [4 /*yield*/, this.getFlag(name, __assign({ sessionId: sessionId }, extraContext))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return FeatureFlagService;
}());
exports.FeatureFlagService = FeatureFlagService;
