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
var jest_mock_extended_1 = require("jest-mock-extended");
var feature_flag_service_1 = require("./feature-flag.service");
describe(feature_flag_service_1.FeatureFlagService.name, function () {
    describe("getFlag", function () {
        it("returns true if config enables all", function () { return __awaiter(void 0, void 0, void 0, function () {
            var service, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        service = setup({ enableAll: true }).service;
                        return [4 /*yield*/, service.getFlag("test-flag")];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        it("evaluates flag and returns true", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, service, unleash, flagsClient, flag, context, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = setup(), service = _a.service, unleash = _a.unleash, flagsClient = _a.flagsClient;
                        flagsClient.isEnabled.mockReturnValue(true);
                        flag = "feature-x";
                        context = { sessionId: "abc123" };
                        return [4 /*yield*/, service.getFlag(flag, context)];
                    case 1:
                        result = _b.sent();
                        expect(unleash.getDefinitions).toHaveBeenCalled();
                        expect(unleash.evaluateFlags).toHaveBeenCalled();
                        expect(unleash.flagsClient).toHaveBeenCalled();
                        expect(flagsClient.isEnabled).toHaveBeenCalledWith(flag);
                        expect(result).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("extractSessionId", function () {
        it("extracts session ID from cookies", function () {
            var service = setup().service;
            var ctx = createCtx("unleash-session-id=session123; foo=bar");
            expect(service.extractSessionId(ctx)).toBe("session123");
        });
        it("returns undefined when session ID is missing", function () {
            var service = setup().service;
            var ctx = createCtx("foo=bar; test=value");
            expect(service.extractSessionId(ctx)).toBeUndefined();
        });
    });
    describe("isEnabledForCtx", function () {
        it("returns true if config enables all", function () { return __awaiter(void 0, void 0, void 0, function () {
            var service, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        service = setup({ enableAll: true }).service;
                        return [4 /*yield*/, service.isEnabledForCtx("my-flag", createCtx(""))];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
        it("evaluates flag and returns result", function () { return __awaiter(void 0, void 0, void 0, function () {
            var service, getFlagSpy, ctx, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        service = setup().service;
                        getFlagSpy = jest.spyOn(service, "getFlag").mockResolvedValue(true);
                        ctx = createCtx("unleash-session-id=abc123");
                        return [4 /*yield*/, service.isEnabledForCtx("my-flag", ctx)];
                    case 1:
                        result = _a.sent();
                        expect(service.extractSessionId).toHaveBeenCalledWith(ctx);
                        expect(getFlagSpy).toHaveBeenCalledWith("my-flag", { sessionId: "abc123" });
                        expect(result).toBe(true);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    function setup(options) {
        var _a;
        var unleash = (0, jest_mock_extended_1.mock)();
        var flagsClient = (0, jest_mock_extended_1.mock)();
        unleash.getDefinitions.mockResolvedValue({ features: [], version: 1 });
        unleash.evaluateFlags.mockReturnValue({ toggles: [] });
        unleash.flagsClient.mockReturnValue(flagsClient);
        flagsClient.isEnabled.mockReturnValue(!!(options === null || options === void 0 ? void 0 : options.isEnabled));
        var config = {
            NEXT_PUBLIC_UNLEASH_ENABLE_ALL: (_a = options === null || options === void 0 ? void 0 : options.enableAll) !== null && _a !== void 0 ? _a : false
        };
        var service = new feature_flag_service_1.FeatureFlagService(unleash, config);
        jest.spyOn(service, "extractSessionId");
        return { service: service, unleash: unleash, flagsClient: flagsClient };
    }
    function createCtx(cookie) {
        return {
            req: {
                headers: {
                    cookie: cookie
                }
            }
        };
    }
});
