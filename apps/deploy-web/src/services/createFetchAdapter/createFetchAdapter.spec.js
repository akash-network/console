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
var axios_1 = require("axios");
var cockatiel_1 = require("cockatiel");
var createFetchAdapter_1 = require("./createFetchAdapter");
describe(createFetchAdapter_1.createFetchAdapter.name, function () {
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.useRealTimers();
    });
    describe("retries", function () {
        it("retries request 3 times if it fails with 5xx", function () { return __awaiter(void 0, void 0, void 0, function () {
            var adapter, fetch, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adapter = jest
                            .fn()
                            .mockImplementationOnce(function (config) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new axios_1.AxiosError("test", "500", config, {}, {
                                    status: 500,
                                    statusText: "test",
                                    headers: {},
                                    data: {},
                                    config: config
                                });
                            });
                        }); })
                            .mockImplementation(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ status: 200, data: "test" })];
                        }); }); });
                        fetch = (0, createFetchAdapter_1.createFetchAdapter)({
                            adapter: adapter
                        });
                        return [4 /*yield*/, Promise.all([fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() }), jest.runAllTimersAsync()])];
                    case 1:
                        result = (_a.sent())[0];
                        expect(adapter).toHaveBeenCalledTimes(2);
                        expect(result.data).toEqual("test");
                        return [2 /*return*/];
                }
            });
        }); });
        it("retries request 3 times if it fails with 429", function () { return __awaiter(void 0, void 0, void 0, function () {
            var adapter, fetch, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adapter = jest
                            .fn()
                            .mockImplementationOnce(function (config) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new axios_1.AxiosError("test", "500", config, {}, {
                                    status: 429,
                                    statusText: "test",
                                    headers: {},
                                    data: {},
                                    config: config
                                });
                            });
                        }); })
                            .mockImplementation(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ status: 200, data: "test" })];
                        }); }); });
                        fetch = (0, createFetchAdapter_1.createFetchAdapter)({
                            adapter: adapter
                        });
                        return [4 /*yield*/, Promise.all([fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() }), jest.runAllTimersAsync()])];
                    case 1:
                        result = (_a.sent())[0];
                        expect(adapter).toHaveBeenCalledTimes(2);
                        expect(result.data).toEqual("test");
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not retry request if it fails with 400", function () { return __awaiter(void 0, void 0, void 0, function () {
            var adapter, fetch, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adapter = jest.fn().mockImplementationOnce(function (config) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new axios_1.AxiosError("test", "500", config, {}, {
                                    status: 400,
                                    statusText: "test",
                                    headers: {},
                                    data: {},
                                    config: config
                                });
                            });
                        }); });
                        fetch = (0, createFetchAdapter_1.createFetchAdapter)({
                            adapter: adapter
                        });
                        return [4 /*yield*/, Promise.all([
                                fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() }).catch(function (error) { return error; }),
                                jest.runAllTimersAsync()
                            ])];
                    case 1:
                        result = (_a.sent())[0];
                        expect(adapter).toHaveBeenCalledTimes(1);
                        expect(result.status).toEqual(400);
                        return [2 /*return*/];
                }
            });
        }); });
        it("respects numeric retry-after header", function () { return __awaiter(void 0, void 0, void 0, function () {
            var adapter, fetch, start, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adapter = jest
                            .fn()
                            .mockImplementationOnce(function (config) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new axios_1.AxiosError("test", "500", config, {}, {
                                    status: 500,
                                    statusText: "test",
                                    headers: { "retry-after": "60" },
                                    data: {},
                                    config: config
                                });
                            });
                        }); })
                            .mockImplementation(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ status: 200, data: "test" })];
                        }); }); });
                        fetch = (0, createFetchAdapter_1.createFetchAdapter)({
                            adapter: adapter
                        });
                        start = Date.now();
                        return [4 /*yield*/, Promise.all([fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() }), jest.runAllTimersAsync()])];
                    case 1:
                        result = (_a.sent())[0];
                        expect(adapter).toHaveBeenCalledTimes(2);
                        expect(Date.now() - start).toBeGreaterThanOrEqual(60 * 1000);
                        expect(result.data).toEqual("test");
                        return [2 /*return*/];
                }
            });
        }); });
        it("respects date retry-after header", function () { return __awaiter(void 0, void 0, void 0, function () {
            var adapter, fetch, start, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adapter = jest
                            .fn()
                            .mockImplementationOnce(function (config) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new axios_1.AxiosError("test", "500", config, {}, {
                                    status: 500,
                                    statusText: "test",
                                    headers: { "retry-after": new Date(Date.now() + 60 * 1000).toUTCString() },
                                    data: {},
                                    config: config
                                });
                            });
                        }); })
                            .mockImplementation(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ status: 200, data: "test" })];
                        }); }); });
                        fetch = (0, createFetchAdapter_1.createFetchAdapter)({
                            adapter: adapter
                        });
                        start = Date.now();
                        return [4 /*yield*/, Promise.all([fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() }), jest.runAllTimersAsync()])];
                    case 1:
                        result = (_a.sent())[0];
                        expect(adapter).toHaveBeenCalledTimes(2);
                        expect(Date.now() - start).toBeGreaterThanOrEqual(60 * 1000);
                        expect(result.data).toEqual("test");
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("circuit breaker", function () {
        it("opens the circuit breaker if it fails 3 times", function () { return __awaiter(void 0, void 0, void 0, function () {
            var adapter, fetch;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adapter = jest.fn().mockImplementation(function (config) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new axios_1.AxiosError("test", "500", config, {}, {
                                    status: 500,
                                    statusText: "test",
                                    headers: {},
                                    data: {},
                                    config: config
                                });
                            });
                        }); });
                        fetch = (0, createFetchAdapter_1.createFetchAdapter)({
                            adapter: adapter
                        });
                        return [4 /*yield*/, Promise.all([fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() }).catch(function (error) { return error; }), jest.runAllTimersAsync()])];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expect(fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() })).rejects.toThrow(cockatiel_1.BrokenCircuitError)];
                    case 2:
                        _a.sent();
                        expect(adapter).toHaveBeenCalledTimes(4);
                        return [2 /*return*/];
                }
            });
        }); });
        it("closes the circuit breaker after halfOpenAfter it succeeds", function () { return __awaiter(void 0, void 0, void 0, function () {
            var adapter, fetch, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        adapter = jest.fn().mockImplementation(function (config) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new axios_1.AxiosError("test", "500", config, {}, {
                                    status: 500,
                                    statusText: "test",
                                    headers: {},
                                    data: {},
                                    config: config
                                });
                            });
                        }); });
                        fetch = (0, createFetchAdapter_1.createFetchAdapter)({
                            adapter: adapter,
                            circuitBreaker: {
                                halfOpenAfter: 1000
                            }
                        });
                        return [4 /*yield*/, Promise.all([fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() }).catch(function (error) { return error; }), jest.runAllTimersAsync()])];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, expect(fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() })).rejects.toThrow(cockatiel_1.BrokenCircuitError)];
                    case 2:
                        _b.sent();
                        adapter.mockImplementationOnce(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ status: 200, data: "test" })];
                        }); }); });
                        jest.advanceTimersByTime(30 * 1000);
                        _a = expect;
                        return [4 /*yield*/, fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() })];
                    case 3:
                        _a.apply(void 0, [_b.sent()]).toEqual({ status: 200, data: "test" });
                        return [2 /*return*/];
                }
            });
        }); });
        it("calls onSuccess callback when request succeeds", function () { return __awaiter(void 0, void 0, void 0, function () {
            var adapter, onSuccess, fetch;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adapter = jest.fn().mockImplementation(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, ({ status: 200, data: "test" })];
                        }); }); });
                        onSuccess = jest.fn();
                        fetch = (0, createFetchAdapter_1.createFetchAdapter)({
                            adapter: adapter,
                            onSuccess: onSuccess
                        });
                        return [4 /*yield*/, fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() })];
                    case 1:
                        _a.sent();
                        expect(adapter).toHaveBeenCalledTimes(1);
                        expect(onSuccess).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
        it("calls onFailure callback when request finally fails", function () { return __awaiter(void 0, void 0, void 0, function () {
            var adapter, onFailure, fetch;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adapter = jest.fn().mockImplementation(function (config) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new axios_1.AxiosError("test", "500", config, {}, {
                                    status: 500,
                                    statusText: "test",
                                    headers: {},
                                    data: {},
                                    config: config
                                });
                            });
                        }); });
                        onFailure = jest.fn();
                        fetch = (0, createFetchAdapter_1.createFetchAdapter)({
                            adapter: adapter,
                            onFailure: onFailure
                        });
                        return [4 /*yield*/, Promise.all([fetch({ method: "GET", url: "/test", headers: new axios_1.AxiosHeaders() }).catch(function (error) { return error; }), jest.runAllTimersAsync()])];
                    case 1:
                        _a.sent();
                        expect(adapter).toHaveBeenCalledTimes(4);
                        expect(onFailure).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
