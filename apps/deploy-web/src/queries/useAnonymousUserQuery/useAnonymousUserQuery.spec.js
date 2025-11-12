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
var axios_1 = require("axios");
var jest_mock_extended_1 = require("jest-mock-extended");
var jotai_1 = require("jotai");
var promises_1 = require("timers/promises");
var query_client_1 = require("../../../tests/unit/query-client");
var useAnonymousUserQuery_1 = require("./useAnonymousUserQuery");
var react_1 = require("@testing-library/react");
describe(useAnonymousUserQuery_1.useAnonymousUserQuery.name, function () {
    var mockUser = {
        id: "test-user-id",
        username: "testuser",
        email: "test@example.com",
        emailVerified: false,
        subscribedToNewsletter: true,
        bio: "Test bio",
        youtubeUsername: "testyoutube",
        twitterUsername: "testtwitter",
        githubUsername: "testgithub"
    };
    it("creates anonymous user if id is not provided", function () { return __awaiter(void 0, void 0, void 0, function () {
        var userService, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    userService = (0, jest_mock_extended_1.mock)({
                        getOrCreateAnonymousUser: jest.fn().mockResolvedValue({
                            data: mockUser,
                            token: "test-token"
                        })
                    });
                    result = setup({
                        services: {
                            user: function () { return userService; }
                        }
                    }).result;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(result.current.user).toEqual(mockUser);
                            expect(result.current.token).toBe("test-token");
                            expect(result.current.isLoading).toBe(false);
                            expect(result.current.error).toBeUndefined();
                        })];
                case 1:
                    _a.sent();
                    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledWith(undefined);
                    return [2 /*return*/];
            }
        });
    }); });
    it("fetches anonymous user if id is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
        var userId, userService, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    userId = "existing-user-id";
                    userService = (0, jest_mock_extended_1.mock)();
                    userService.getOrCreateAnonymousUser.mockResolvedValue({
                        data: mockUser
                    });
                    result = setup({
                        services: {
                            user: function () { return userService; }
                        },
                        id: userId
                    }).result;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(result.current.user).toEqual(mockUser);
                            expect(result.current.token).toBeUndefined();
                            expect(result.current.isLoading).toBe(false);
                            expect(result.current.error).toBeUndefined();
                        })];
                case 1:
                    _a.sent();
                    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledWith(userId);
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles 429 rate limit error with retryAfter", function () { return __awaiter(void 0, void 0, void 0, function () {
        var retryAfterSeconds, rateLimitError, userService, result, expectedRetryTime;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    retryAfterSeconds = 30;
                    rateLimitError = new axios_1.AxiosError("Too Many Requests", "429", undefined, undefined, {
                        status: 429,
                        statusText: "Too Many Requests",
                        headers: {},
                        data: { retryAfter: retryAfterSeconds },
                        config: {}
                    });
                    userService = (0, jest_mock_extended_1.mock)({
                        getOrCreateAnonymousUser: jest.fn().mockRejectedValue(rateLimitError)
                    });
                    result = setup({
                        services: {
                            user: function () { return userService; }
                        }
                    }).result;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(result.current.isLoading).toBe(false);
                            expect(result.current.error).toBe(rateLimitError);
                            expect(result.current.retryAfter).toBeDefined();
                        })];
                case 1:
                    _a.sent();
                    expectedRetryTime = new Date(Date.now() + retryAfterSeconds * 1000);
                    expect(result.current.retryAfter.getTime()).toBeGreaterThanOrEqual(expectedRetryTime.getTime() - 1000);
                    expect(result.current.retryAfter.getTime()).toBeLessThanOrEqual(expectedRetryTime.getTime() + 1000);
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles 429 rate limit error with default retryAfter when not provided", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rateLimitError, userService, result, expectedRetryTime;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rateLimitError = new axios_1.AxiosError("Too Many Requests", "429", undefined, undefined, {
                        status: 429,
                        statusText: "Too Many Requests",
                        headers: {},
                        data: {},
                        config: {}
                    });
                    userService = (0, jest_mock_extended_1.mock)({
                        getOrCreateAnonymousUser: jest.fn().mockRejectedValue(rateLimitError)
                    });
                    result = setup({
                        services: {
                            user: function () { return userService; }
                        }
                    }).result;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(result.current.isLoading).toBe(false);
                            expect(result.current.error).toBe(rateLimitError);
                            expect(result.current.retryAfter).toBeDefined();
                        })];
                case 1:
                    _a.sent();
                    expectedRetryTime = new Date(Date.now() + useAnonymousUserQuery_1.DEFAULT_RETRY_AFTER_SECONDS * 1000);
                    expect(result.current.retryAfter.getTime()).toBeGreaterThanOrEqual(expectedRetryTime.getTime() - 1000);
                    expect(result.current.retryAfter.getTime()).toBeLessThanOrEqual(expectedRetryTime.getTime() + 1000);
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles generic error", function () { return __awaiter(void 0, void 0, void 0, function () {
        var genericError, userService, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    genericError = new Error("Network error");
                    userService = (0, jest_mock_extended_1.mock)({
                        getOrCreateAnonymousUser: jest.fn().mockRejectedValue(genericError)
                    });
                    result = setup({
                        services: {
                            user: function () { return userService; }
                        }
                    }).result;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(result.current.isLoading).toBe(false);
                            expect(result.current.error).toBe(genericError);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("reports errors to error handler", function () { return __awaiter(void 0, void 0, void 0, function () {
        var userService, errorHandler, genericError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    userService = (0, jest_mock_extended_1.mock)();
                    errorHandler = (0, jest_mock_extended_1.mock)();
                    genericError = new Error("Network error");
                    userService.getOrCreateAnonymousUser.mockRejectedValue(genericError);
                    setup({
                        services: {
                            user: function () { return userService; },
                            errorHandler: function () { return errorHandler; }
                        }
                    });
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(errorHandler.reportError).toHaveBeenCalledWith({
                                error: genericError,
                                tags: { category: "anonymousUserQuery" }
                            });
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("does not fetch when enabled is false", function () { return __awaiter(void 0, void 0, void 0, function () {
        var userService, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    userService = (0, jest_mock_extended_1.mock)();
                    result = setup({
                        services: {
                            user: function () { return userService; }
                        },
                        options: { enabled: false }
                    }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return (0, promises_1.setTimeout)(1000); })];
                case 1:
                    _a.sent();
                    expect(result.current.user).toBeUndefined();
                    expect(result.current.isLoading).toBe(false);
                    expect(userService.getOrCreateAnonymousUser).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it("does not fetch when user already exists", function () { return __awaiter(void 0, void 0, void 0, function () {
        var userService, _a, result, rerender;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    userService = (0, jest_mock_extended_1.mock)({
                        getOrCreateAnonymousUser: jest.fn().mockResolvedValue({
                            data: mockUser,
                            token: "test-token"
                        })
                    });
                    _a = setup({
                        services: {
                            user: function () { return userService; }
                        }
                    }), result = _a.result, rerender = _a.rerender;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(result.current.user).toEqual(mockUser);
                        })];
                case 1:
                    _b.sent();
                    rerender();
                    return [4 /*yield*/, (0, react_1.act)(function () { return (0, promises_1.setTimeout)(1000); })];
                case 2:
                    _b.sent();
                    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it("does not fetch when already loading", function () { return __awaiter(void 0, void 0, void 0, function () {
        var pendingPromise, userService, _a, result, rerender;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    pendingPromise = Promise.withResolvers();
                    userService = (0, jest_mock_extended_1.mock)({
                        getOrCreateAnonymousUser: jest.fn().mockReturnValue(pendingPromise.promise)
                    });
                    _a = setup({
                        services: {
                            user: function () { return userService; }
                        }
                    }), result = _a.result, rerender = _a.rerender;
                    expect(result.current.isLoading).toBe(true);
                    rerender();
                    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledTimes(1);
                    (0, react_1.act)(function () { return pendingPromise.resolve({ data: mockUser, token: "test-token" }); });
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(result.current.isLoading).toBe(false);
                            expect(result.current.user).toEqual(mockUser);
                        })];
                case 1:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("refetches when retryAfter time has passed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var userService, retryAfterSeconds, rateLimitError, _a, result, rerender;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    userService = (0, jest_mock_extended_1.mock)();
                    retryAfterSeconds = 1;
                    rateLimitError = new axios_1.AxiosError("Too Many Requests", "429", undefined, undefined, {
                        status: 429,
                        statusText: "Too Many Requests",
                        headers: {},
                        data: { retryAfter: retryAfterSeconds },
                        config: {}
                    });
                    userService.getOrCreateAnonymousUser.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce({
                        data: mockUser,
                        token: "test-token"
                    });
                    _a = setup({
                        services: {
                            user: function () { return userService; }
                        }
                    }), result = _a.result, rerender = _a.rerender;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(result.current.error).toBe(rateLimitError);
                        })];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, (0, react_1.act)(function () { return (0, promises_1.setTimeout)(retryAfterSeconds * 1000 + 100); })];
                case 2:
                    _b.sent();
                    rerender();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(result.current.user).toEqual(mockUser);
                            expect(result.current.error).toBeUndefined();
                        })];
                case 3:
                    _b.sent();
                    expect(userService.getOrCreateAnonymousUser).toHaveBeenCalledTimes(2);
                    return [2 /*return*/];
            }
        });
    }); });
    function setup(input) {
        var store = (0, jotai_1.createStore)();
        return (0, query_client_1.setupQuery)(function () {
            return (0, useAnonymousUserQuery_1.useAnonymousUserQuery)(input === null || input === void 0 ? void 0 : input.id, __assign({ enabled: true }, input === null || input === void 0 ? void 0 : input.options));
        }, {
            services: __assign({ errorHandler: function () { return (0, jest_mock_extended_1.mock)(); } }, input === null || input === void 0 ? void 0 : input.services),
            wrapper: function (_a) {
                var children = _a.children;
                return <jotai_1.Provider store={store}>{children}</jotai_1.Provider>;
            }
        });
    }
});
