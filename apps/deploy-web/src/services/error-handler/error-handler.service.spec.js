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
var jest_mock_extended_1 = require("jest-mock-extended");
var error_handler_service_1 = require("./error-handler.service");
describe(error_handler_service_1.ErrorHandlerService.name, function () {
    it("handles generic error without extra metadata", function () {
        var captureException = jest.fn().mockReturnValue("event-id-1");
        var logger = (0, jest_mock_extended_1.mock)();
        var errorHandler = setup({ captureException: captureException, logger: logger });
        var error = new Error("Generic error");
        errorHandler.reportError({ error: error, tags: { category: "test", event: "TEST_ERROR" }, message: "test message" });
        expect(captureException).toHaveBeenCalledWith(error, {
            extra: { message: "test message" },
            tags: { category: "test", event: "TEST_ERROR" }
        });
        expect(logger.error).toHaveBeenCalledWith({ error: error, category: "test", event: "TEST_ERROR", message: "test message" });
    });
    it("handles HTTP error with response metadata", function () {
        var captureException = jest.fn().mockReturnValue("event-id-2");
        var errorHandler = setup({ captureException: captureException });
        var config = {
            method: "get",
            url: "https://api.example.com/users"
        };
        var httpError = new axios_1.AxiosError("Request failed", "400", config, {}, {
            status: 404,
            statusText: "Not Found",
            headers: {
                "content-type": "application/json",
                "x-request-id": "123-456-789"
            },
            data: {},
            config: config
        });
        errorHandler.reportError({ error: httpError });
        expect(captureException).toHaveBeenCalledWith(httpError, {
            extra: {
                headers: {
                    "content-type": "application/json",
                    "x-request-id": "123-456-789"
                }
            },
            tags: {
                status: "404",
                method: "GET",
                url: "https://api.example.com/users"
            }
        });
    });
    describe("wrapCallback", function () {
        it("wraps synchronous function and reports error", function () {
            var captureException = jest.fn();
            var errorHandler = setup({ captureException: captureException });
            var error = new Error("test error");
            var fn = function () {
                throw error;
            };
            var wrapped = errorHandler.wrapCallback(fn, {
                tags: { category: "test" }
            });
            wrapped();
            expect(captureException).toHaveBeenCalledWith(error, expect.objectContaining({
                extra: {},
                tags: { category: "test" }
            }));
        });
        it("wraps async function and reports error", function () { return __awaiter(void 0, void 0, void 0, function () {
            var captureException, errorHandler, error, fn, wrapped;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        captureException = jest.fn();
                        errorHandler = setup({ captureException: captureException });
                        error = new Error("test error");
                        fn = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw error;
                            });
                        }); };
                        wrapped = errorHandler.wrapCallback(fn, {
                            tags: { category: "test" }
                        });
                        return [4 /*yield*/, wrapped()];
                    case 1:
                        _a.sent();
                        expect(captureException).toHaveBeenCalledWith(error, expect.objectContaining({
                            tags: { category: "test" }
                        }));
                        return [2 /*return*/];
                }
            });
        }); });
        it("returns fallback value when provided", function () {
            var captureException = jest.fn();
            var errorHandler = setup({ captureException: captureException });
            var error = new Error("test error");
            var fn = function () {
                throw error;
            };
            var fallbackValue = function () { return "fallback"; };
            var wrapped = errorHandler.wrapCallback(fn, {
                tags: { category: "test" },
                fallbackValue: fallbackValue
            });
            var result = wrapped();
            expect(result).toBe("fallback");
            expect(captureException).toHaveBeenCalledWith(error, {
                extra: {},
                tags: { category: "test" }
            });
        });
        it("returns fallback value for async function when provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var captureException, errorHandler, error, fn, fallbackValue, wrapped, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        captureException = jest.fn();
                        errorHandler = setup({ captureException: captureException });
                        error = new Error("test error");
                        fn = function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw error;
                            });
                        }); };
                        fallbackValue = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "fallback"];
                        }); }); };
                        wrapped = errorHandler.wrapCallback(fn, {
                            tags: { category: "test" },
                            fallbackValue: fallbackValue
                        });
                        return [4 /*yield*/, wrapped()];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe("fallback");
                        expect(captureException).toHaveBeenCalledWith(error, {
                            extra: {},
                            tags: { category: "test" }
                        });
                        return [2 /*return*/];
                }
            });
        }); });
        it("passes through return value when no error occurs", function () {
            var captureException = jest.fn();
            var errorHandler = setup({ captureException: captureException });
            var fn = function () { return "success"; };
            var wrapped = errorHandler.wrapCallback(fn);
            var result = wrapped();
            expect(result).toBe("success");
            expect(captureException).not.toHaveBeenCalled();
        });
        it("passes through return value when no error occurs in async function", function () { return __awaiter(void 0, void 0, void 0, function () {
            var captureException, errorHandler, fn, wrapped, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        captureException = jest.fn();
                        errorHandler = setup({ captureException: captureException });
                        fn = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "success"];
                        }); }); };
                        wrapped = errorHandler.wrapCallback(fn);
                        return [4 /*yield*/, wrapped()];
                    case 1:
                        result = _a.sent();
                        expect(result).toBe("success");
                        expect(captureException).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    function setup(input) {
        var captureException = (input === null || input === void 0 ? void 0 : input.captureException) || jest.fn().mockReturnValue("mock-event-id");
        return new error_handler_service_1.ErrorHandlerService((input === null || input === void 0 ? void 0 : input.logger) || (0, jest_mock_extended_1.mock)(), captureException);
    }
});
