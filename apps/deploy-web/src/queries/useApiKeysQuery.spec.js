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
var react_query_1 = require("@tanstack/react-query");
var jest_mock_extended_1 = require("jest-mock-extended");
var useApiKeysQuery_1 = require("./useApiKeysQuery");
var react_1 = require("@testing-library/react");
var seeders_1 = require("@tests/seeders");
var query_client_1 = require("@tests/unit/query-client");
var mockApiKeys = [(0, seeders_1.buildApiKey)({ id: "key-1", name: "Test Key 1" }), (0, seeders_1.buildApiKey)({ id: "key-2", name: "Test Key 2" })];
var mockUser = (0, seeders_1.buildUser)();
var mockWallet = (0, seeders_1.buildWallet)();
describe("useApiKeysQuery", function () {
    describe("useUserApiKeys", function () {
        it("should be disabled when user is not provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeyService, result;
            return __generator(this, function (_a) {
                apiKeyService = (0, jest_mock_extended_1.mock)({
                    getApiKeys: jest.fn().mockResolvedValue(mockApiKeys)
                });
                result = setupApiKeysQuery({
                    user: undefined,
                    wallet: mockWallet,
                    services: {
                        apiKey: function () { return apiKeyService; }
                    }
                }).result;
                // Verify the service was not called since the query is disabled
                expect(apiKeyService.getApiKeys).not.toHaveBeenCalled();
                // Verify the query data is undefined
                expect(result.current.query.data).toBeUndefined();
                // Verify the query is not in a loading or success state
                expect(result.current.query.isLoading).toBe(false);
                expect(result.current.query.isSuccess).toBe(false);
                return [2 /*return*/];
            });
        }); });
        it("should return undefined and not fetch when user is trialing", function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeyService, result;
            return __generator(this, function (_a) {
                apiKeyService = (0, jest_mock_extended_1.mock)({
                    getApiKeys: jest.fn()
                });
                result = setupApiKeysQuery({
                    user: mockUser,
                    wallet: __assign(__assign({}, mockWallet), { isTrialing: true }),
                    services: {
                        apiKey: function () { return apiKeyService; }
                    }
                }).result;
                expect(result.current.query.fetchStatus).toBe("idle");
                expect(apiKeyService.getApiKeys).not.toHaveBeenCalled();
                expect(result.current.query.data).toBeUndefined();
                return [2 /*return*/];
            });
        }); });
        it("should return undefined and not fetch when wallet is not managed", function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeyService, result;
            return __generator(this, function (_a) {
                apiKeyService = (0, jest_mock_extended_1.mock)({
                    getApiKeys: jest.fn()
                });
                result = setupApiKeysQuery({
                    user: mockUser,
                    wallet: __assign(__assign({}, mockWallet), { isManaged: false }),
                    services: {
                        apiKey: function () { return apiKeyService; }
                    }
                }).result;
                expect(result.current.query.fetchStatus).toBe("idle");
                expect(apiKeyService.getApiKeys).not.toHaveBeenCalled();
                expect(result.current.query.data).toBeUndefined();
                return [2 /*return*/];
            });
        }); });
        it("should fetch API keys when user is valid and wallet is managed", function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeyService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        apiKeyService = (0, jest_mock_extended_1.mock)({
                            getApiKeys: jest.fn().mockResolvedValue(mockApiKeys)
                        });
                        result = setupApiKeysQuery({
                            user: mockUser,
                            wallet: mockWallet,
                            services: {
                                apiKey: function () { return apiKeyService; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.query.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        expect(apiKeyService.getApiKeys).toHaveBeenCalled();
                        expect(result.current.query.data).toEqual(mockApiKeys);
                        return [2 /*return*/];
                }
            });
        }); });
        it("should use the correct query key", function () { return __awaiter(void 0, void 0, void 0, function () {
            var apiKeyService, queryClient, result, expectedQueryKey, queryCache, queries;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        apiKeyService = (0, jest_mock_extended_1.mock)({
                            getApiKeys: jest.fn().mockResolvedValue(mockApiKeys)
                        });
                        queryClient = new react_query_1.QueryClient();
                        result = setupApiKeysQuery({
                            user: mockUser,
                            wallet: mockWallet,
                            services: {
                                apiKey: function () { return apiKeyService; },
                                queryClient: function () { return queryClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.query.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        expect(result.current.query.data).toEqual(mockApiKeys);
                        expectedQueryKey = ["API_KEYS", mockUser.userId];
                        queryCache = queryClient.getQueryCache();
                        queries = queryCache.findAll({ queryKey: expectedQueryKey });
                        expect(queries).toHaveLength(1);
                        expect(queries[0].queryKey).toEqual(expectedQueryKey);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("useCreateApiKey", function () {
        it("should create API key successfully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var newApiKey, apiKeyService, queryClient, result, expectedQueryKey, cachedData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        newApiKey = (0, seeders_1.buildApiKey)({ id: "new-key", name: "New Key" });
                        apiKeyService = (0, jest_mock_extended_1.mock)({
                            createApiKey: jest.fn().mockResolvedValue(newApiKey)
                        });
                        queryClient = new react_query_1.QueryClient();
                        result = (0, query_client_1.setupQuery)(function () {
                            var dependencies = __assign(__assign({}, useApiKeysQuery_1.USE_API_KEYS_DEPENDENCIES), { useUser: function () { return ({
                                    user: mockUser,
                                    isLoading: false
                                }); }, useWallet: function () { return mockWallet; } });
                            return (0, useApiKeysQuery_1.useCreateApiKey)(dependencies);
                        }, {
                            services: {
                                apiKey: function () { return apiKeyService; },
                                queryClient: function () { return queryClient; }
                            }
                        }).result;
                        (0, react_1.act)(function () {
                            result.current.mutate("New Key");
                        });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        expect(apiKeyService.createApiKey).toHaveBeenCalledWith({
                            data: { name: "New Key" }
                        });
                        expectedQueryKey = ["API_KEYS", mockUser.userId];
                        cachedData = queryClient.getQueryData(expectedQueryKey);
                        expect(cachedData).toContainEqual(newApiKey);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("useDeleteApiKey", function () {
        it("should delete API key successfully", function () { return __awaiter(void 0, void 0, void 0, function () {
            var keyToDelete, remainingKeys, apiKeyService, queryClient, result, expectedQueryKey, cachedData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        keyToDelete = (0, seeders_1.buildApiKey)({ id: "key-1", name: "Key to Delete" });
                        remainingKeys = [(0, seeders_1.buildApiKey)({ id: "key-2", name: "Remaining Key" })];
                        apiKeyService = (0, jest_mock_extended_1.mock)({
                            deleteApiKey: jest.fn().mockResolvedValue(undefined)
                        });
                        queryClient = new react_query_1.QueryClient();
                        result = (0, query_client_1.setupQuery)(function () {
                            var dependencies = __assign(__assign({}, useApiKeysQuery_1.USE_API_KEYS_DEPENDENCIES), { useUser: function () { return ({
                                    user: mockUser,
                                    isLoading: false
                                }); }, useWallet: function () { return mockWallet; } });
                            return (0, useApiKeysQuery_1.useDeleteApiKey)("key-1", undefined, dependencies);
                        }, {
                            services: {
                                apiKey: function () { return apiKeyService; },
                                queryClient: function () {
                                    // Pre-seed the cache with the key to be deleted
                                    var expectedQueryKey = ["API_KEYS", mockUser.userId];
                                    queryClient.setQueryData(expectedQueryKey, __spreadArray([keyToDelete], remainingKeys, true));
                                    return queryClient;
                                }
                            }
                        }).result;
                        (0, react_1.act)(function () {
                            result.current.mutate();
                        });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        expect(apiKeyService.deleteApiKey).toHaveBeenCalledWith("key-1");
                        expectedQueryKey = ["API_KEYS", mockUser.userId];
                        cachedData = queryClient.getQueryData(expectedQueryKey);
                        expect(cachedData).toEqual(remainingKeys);
                        expect(cachedData).not.toContainEqual(keyToDelete);
                        return [2 /*return*/];
                }
            });
        }); });
        it("should call onSuccess callback when deletion succeeds", function () { return __awaiter(void 0, void 0, void 0, function () {
            var onSuccess, apiKeyService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        onSuccess = jest.fn();
                        apiKeyService = (0, jest_mock_extended_1.mock)({
                            deleteApiKey: jest.fn().mockResolvedValue(undefined)
                        });
                        result = (0, query_client_1.setupQuery)(function () {
                            var dependencies = __assign(__assign({}, useApiKeysQuery_1.USE_API_KEYS_DEPENDENCIES), { useUser: function () { return ({
                                    user: mockUser,
                                    isLoading: false
                                }); }, useWallet: function () { return mockWallet; } });
                            return (0, useApiKeysQuery_1.useDeleteApiKey)("key-1", onSuccess, dependencies);
                        }, {
                            services: {
                                apiKey: function () { return apiKeyService; }
                            }
                        }).result;
                        (0, react_1.act)(function () {
                            result.current.mutate();
                        });
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        expect(onSuccess).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    function setupApiKeysQuery(input) {
        var dependencies = __assign(__assign({}, useApiKeysQuery_1.USE_API_KEYS_DEPENDENCIES), { useUser: function () { return ({
                user: input === null || input === void 0 ? void 0 : input.user,
                isLoading: false
            }); }, useWallet: function () { return (input === null || input === void 0 ? void 0 : input.wallet) || mockWallet; } });
        return (0, query_client_1.setupQuery)(function () {
            return {
                query: (0, useApiKeysQuery_1.useUserApiKeys)({}, dependencies),
                dependencies: dependencies
            };
        }, {
            services: __assign({ apiKey: function () { return (0, jest_mock_extended_1.mock)(); } }, input === null || input === void 0 ? void 0 : input.services)
        });
    }
});
