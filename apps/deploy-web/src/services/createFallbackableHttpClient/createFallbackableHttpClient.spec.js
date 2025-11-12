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
var http_sdk_1 = require("@akashnetwork/http-sdk");
var cockatiel_1 = require("cockatiel");
var jest_mock_extended_1 = require("jest-mock-extended");
var createFallbackableHttpClient_1 = require("./createFallbackableHttpClient");
describe(createFallbackableHttpClient_1.createFallbackableHttpClient.name, function () {
    var originalFetch = globalThis.fetch;
    afterEach(function () {
        globalThis.fetch = originalFetch;
        jest.useRealTimers();
    });
    it("uses fallback http client when request fails after 3 retries and should", function () { return __awaiter(void 0, void 0, void 0, function () {
        var onUnavailableError, options, fetch, _a, chainApiHttpClient, fallbackHttpClient;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    onUnavailableError = jest.fn();
                    options = {
                        baseURL: "https://api.test.com",
                        shouldFallback: function () { return false; },
                        onUnavailableError: onUnavailableError
                    };
                    fetch = jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, new Response("error", { status: 500 })];
                    }); }); });
                    _a = setup({ options: options, fetch: fetch }), chainApiHttpClient = _a.chainApiHttpClient, fallbackHttpClient = _a.fallbackHttpClient;
                    return [4 /*yield*/, Promise.all([chainApiHttpClient.get("/test"), jest.runAllTimersAsync()])];
                case 1:
                    _b.sent();
                    expect(fallbackHttpClient.request).toHaveBeenCalledWith(expect.objectContaining({
                        method: "get",
                        baseURL: options.baseURL,
                        url: "/test"
                    }));
                    expect(onUnavailableError).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls onSuccess callback when request succeeds", function () { return __awaiter(void 0, void 0, void 0, function () {
        var onSuccess, options, fetch, chainApiHttpClient;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onSuccess = jest.fn();
                    options = {
                        baseURL: "https://api.test.com",
                        shouldFallback: function () { return false; },
                        onSuccess: onSuccess
                    };
                    fetch = jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, new Response("test", { status: 200 })];
                    }); }); });
                    chainApiHttpClient = setup({ options: options, fetch: fetch }).chainApiHttpClient;
                    return [4 /*yield*/, Promise.all([chainApiHttpClient.get("/test"), jest.runAllTimersAsync()])];
                case 1:
                    _a.sent();
                    expect(onSuccess).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it("falls back to fallback http client if shouldFallback returns true (circuit breaker is open)", function () { return __awaiter(void 0, void 0, void 0, function () {
        var onUnavailableError, options, fetch, _a, chainApiHttpClient, fallbackHttpClient;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    onUnavailableError = jest.fn();
                    options = {
                        baseURL: "https://api.test.com",
                        shouldFallback: function () { return true; },
                        onUnavailableError: onUnavailableError
                    };
                    fetch = jest.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, new Response("test", { status: 500 })];
                    }); }); });
                    _a = setup({ options: options, fetch: fetch }), chainApiHttpClient = _a.chainApiHttpClient, fallbackHttpClient = _a.fallbackHttpClient;
                    return [4 /*yield*/, Promise.all([chainApiHttpClient.get("/test"), jest.runAllTimersAsync()])];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, chainApiHttpClient.get("/test")];
                case 2:
                    _b.sent(); // fails fast becaues circuit breaker is open
                    expect(onUnavailableError).toHaveBeenCalledWith(expect.any(cockatiel_1.BrokenCircuitError));
                    expect(fallbackHttpClient.request).toHaveBeenCalledTimes(2); // once after failed retries, another one when circuit breaker is open
                    return [2 /*return*/];
            }
        });
    }); });
    function setup(input) {
        var _this = this;
        jest.useFakeTimers();
        globalThis.fetch = input.fetch || jest.fn().mockResolvedValue(new Response("test"));
        var fallbackHttpClient = (0, jest_mock_extended_1.mock)({
            request: jest.fn(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, ({ data: "test", status: 200 })];
            }); }); })
        });
        var chainApiHttpClient = (0, createFallbackableHttpClient_1.createFallbackableHttpClient)(http_sdk_1.createHttpClient, fallbackHttpClient, input.options);
        return {
            chainApiHttpClient: chainApiHttpClient,
            fallbackHttpClient: fallbackHttpClient,
            fetch: globalThis.fetch
        };
    }
});
