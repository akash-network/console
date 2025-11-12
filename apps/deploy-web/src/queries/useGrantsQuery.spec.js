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
var faker_1 = require("@faker-js/faker");
var jest_mock_extended_1 = require("jest-mock-extended");
var SettingsProviderContext_1 = require("@src/context/SettingsProvider/SettingsProviderContext");
var useGrantsQuery_1 = require("./useGrantsQuery");
var react_1 = require("@testing-library/react");
var query_client_1 = require("@tests/unit/query-client");
var createMockSettingsContext = function () {
    return (0, jest_mock_extended_1.mock)({
        settings: {
            apiEndpoint: "https://api.example.com",
            rpcEndpoint: "https://rpc.example.com",
            isCustomNode: false,
            nodes: [],
            selectedNode: null,
            customNode: null,
            isBlockchainDown: false
        },
        setSettings: jest.fn(),
        isLoadingSettings: false,
        isSettingsInit: true,
        refreshNodeStatuses: jest.fn(),
        isRefreshingNodeStatus: false
    });
};
var MockSettingsProvider = function (_a) {
    var children = _a.children;
    var mockSettings = createMockSettingsContext();
    return <SettingsProviderContext_1.SettingsProviderContext.Provider value={mockSettings}>{children}</SettingsProviderContext_1.SettingsProviderContext.Provider>;
};
describe("useGrantsQuery", function () {
    describe(useGrantsQuery_1.useGranterGrants.name, function () {
        it("fetches granter grants when address is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, authzHttpService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockData = {
                            grants: [
                                {
                                    authorization: {
                                        "@type": "/akash.escrow.v1.DepositAuthorization"
                                    }
                                }
                            ],
                            pagination: { total: 1 }
                        };
                        authzHttpService = (0, jest_mock_extended_1.mock)({
                            isReady: true,
                            getPaginatedDepositDeploymentGrants: jest.fn().mockResolvedValue(mockData)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGrantsQuery_1.useGranterGrants)("test-address", 0, 1000); }, {
                            services: {
                                authzHttpService: function () { return authzHttpService; }
                            },
                            wrapper: function (_a) {
                                var children = _a.children;
                                return <MockSettingsProvider>{children}</MockSettingsProvider>;
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(authzHttpService.getPaginatedDepositDeploymentGrants).toHaveBeenCalledWith({ granter: "test-address", limit: 1000, offset: 0 });
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockData);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not fetch when address is not provided", function () {
            var authzHttpService = (0, jest_mock_extended_1.mock)({
                isReady: true,
                getPaginatedDepositDeploymentGrants: jest.fn().mockResolvedValue([])
            });
            (0, query_client_1.setupQuery)(function () { return (0, useGrantsQuery_1.useGranterGrants)("", 0, 1000); }, {
                services: {
                    authzHttpService: function () { return authzHttpService; }
                },
                wrapper: function (_a) {
                    var children = _a.children;
                    return <MockSettingsProvider>{children}</MockSettingsProvider>;
                }
            });
            expect(authzHttpService.getPaginatedDepositDeploymentGrants).not.toHaveBeenCalled();
        });
    });
    describe(useGrantsQuery_1.useGranteeGrants.name, function () {
        it("fetches grantee grants when address is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, authzHttpService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockData = [
                            {
                                authorization: {
                                    "@type": "/akash.escrow.v1.DepositAuthorization"
                                }
                            }
                        ];
                        authzHttpService = (0, jest_mock_extended_1.mock)({
                            isReady: true,
                            getAllDepositDeploymentGrants: jest.fn().mockResolvedValue(mockData)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGrantsQuery_1.useGranteeGrants)("test-address"); }, {
                            services: {
                                authzHttpService: function () { return authzHttpService; }
                            },
                            wrapper: function (_a) {
                                var children = _a.children;
                                return <MockSettingsProvider>{children}</MockSettingsProvider>;
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(authzHttpService.getAllDepositDeploymentGrants).toHaveBeenCalledWith({ grantee: "test-address", limit: 1000 });
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockData);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not fetch when address is not provided", function () {
            var authzHttpService = (0, jest_mock_extended_1.mock)({
                isReady: true,
                getAllDepositDeploymentGrants: jest.fn().mockResolvedValue([])
            });
            (0, query_client_1.setupQuery)(function () { return (0, useGrantsQuery_1.useGranteeGrants)(""); }, {
                services: {
                    authzHttpService: function () { return authzHttpService; }
                },
                wrapper: function (_a) {
                    var children = _a.children;
                    return <MockSettingsProvider>{children}</MockSettingsProvider>;
                }
            });
            expect(authzHttpService.getAllDepositDeploymentGrants).not.toHaveBeenCalled();
        });
    });
    describe(useGrantsQuery_1.useAllowancesIssued.name, function () {
        it("fetches allowances issued when address is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, authzHttpService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockData = {
                            allowances: [{ id: faker_1.faker.string.uuid() }],
                            pagination: { total: 1 }
                        };
                        authzHttpService = (0, jest_mock_extended_1.mock)({
                            isReady: true,
                            getPaginatedFeeAllowancesForGranter: jest.fn().mockResolvedValue(mockData)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGrantsQuery_1.useAllowancesIssued)("test-address", 0, 1000); }, {
                            services: {
                                authzHttpService: function () { return authzHttpService; }
                            },
                            wrapper: function (_a) {
                                var children = _a.children;
                                return <MockSettingsProvider>{children}</MockSettingsProvider>;
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(authzHttpService.getPaginatedFeeAllowancesForGranter).toHaveBeenCalledWith("test-address", 1000, 0);
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockData);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not fetch when address is not provided", function () {
            var authzHttpService = (0, jest_mock_extended_1.mock)({
                isReady: true,
                getPaginatedFeeAllowancesForGranter: jest.fn().mockResolvedValue([])
            });
            (0, query_client_1.setupQuery)(function () { return (0, useGrantsQuery_1.useAllowancesIssued)("", 0, 1000); }, {
                services: {
                    authzHttpService: function () { return authzHttpService; }
                },
                wrapper: function (_a) {
                    var children = _a.children;
                    return <MockSettingsProvider>{children}</MockSettingsProvider>;
                }
            });
            expect(authzHttpService.getPaginatedFeeAllowancesForGranter).not.toHaveBeenCalled();
        });
    });
    describe(useGrantsQuery_1.useAllowancesGranted.name, function () {
        it("fetches allowances granted when address is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, chainApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockData = [{ id: faker_1.faker.string.uuid() }];
                        chainApiHttpClient = (0, jest_mock_extended_1.mock)({
                            isFallbackEnabled: false,
                            get: jest.fn().mockResolvedValue({
                                data: {
                                    allowances: mockData,
                                    pagination: { next_key: null, total: mockData.length }
                                }
                            })
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useGrantsQuery_1.useAllowancesGranted)("test-address"); }, {
                            services: {
                                chainApiHttpClient: function () { return chainApiHttpClient; }
                            },
                            wrapper: function (_a) {
                                var children = _a.children;
                                return <MockSettingsProvider>{children}</MockSettingsProvider>;
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining("/cosmos/feegrant/v1beta1/allowances/test-address?pagination.limit=1000&pagination.count_total=true"));
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockData);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("does not fetch when address is not provided", function () {
            var chainApiHttpClient = (0, jest_mock_extended_1.mock)({
                isFallbackEnabled: false,
                get: jest.fn().mockResolvedValue({
                    data: {
                        allowances: [],
                        pagination: { next_key: null, total: 0 }
                    }
                })
            });
            (0, query_client_1.setupQuery)(function () { return (0, useGrantsQuery_1.useAllowancesGranted)(""); }, {
                services: {
                    chainApiHttpClient: function () { return chainApiHttpClient; }
                },
                wrapper: function (_a) {
                    var children = _a.children;
                    return <MockSettingsProvider>{children}</MockSettingsProvider>;
                }
            });
            expect(chainApiHttpClient.get).not.toHaveBeenCalled();
        });
    });
});
