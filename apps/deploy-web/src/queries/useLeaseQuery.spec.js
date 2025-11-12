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
var react_query_1 = require("@tanstack/react-query");
var jest_mock_extended_1 = require("jest-mock-extended");
var deploymentDetailUtils_1 = require("@src/utils/deploymentDetailUtils");
var query_client_1 = require("../../tests/unit/query-client");
var queryKeys_1 = require("./queryKeys");
var useLeaseQuery_1 = require("./useLeaseQuery");
var react_1 = require("@testing-library/react");
var provider_1 = require("@tests/seeders/provider");
var mockDeployment = {
    dseq: "123",
    groups: []
};
var mockLeases = [
    {
        lease: {
            id: {
                owner: "test-owner",
                dseq: "123",
                gseq: 1,
                oseq: 1,
                provider: "provider1",
                bseq: 1
            },
            state: "active",
            price: {
                amount: "1000",
                denom: "uakt"
            },
            created_at: new Date().toISOString(),
            closed_on: ""
        },
        escrow_payment: {
            id: {
                aid: {
                    scope: "test-scope",
                    xid: "test-xid"
                },
                xid: "test-payment-id"
            },
            state: {
                owner: "test-owner",
                state: "active",
                rate: {
                    denom: "uakt",
                    amount: "1000"
                },
                balance: {
                    denom: "uakt",
                    amount: "1000"
                },
                unsettled: {
                    denom: "uakt",
                    amount: "0"
                },
                withdrawn: {
                    denom: "uakt",
                    amount: "0"
                }
            }
        }
    }
];
var mockLeaseStatus = {
    forwarded_ports: {},
    ips: {},
    services: {}
};
var mockGroup = {
    id: {
        owner: "test-owner",
        dseq: "123",
        gseq: 1
    },
    state: "active",
    group_spec: {
        name: "test-group",
        requirements: {
            signed_by: {
                all_of: [],
                any_of: []
            },
            attributes: []
        },
        resources: []
    },
    created_at: new Date().toISOString()
};
var mockLease = {
    id: "test-lease-id",
    owner: "test-owner",
    provider: "test-provider",
    dseq: "123",
    gseq: 1,
    oseq: 1,
    state: "active",
    price: {
        denom: "uakt",
        amount: "1000"
    },
    cpuAmount: 1,
    gpuAmount: 0,
    memoryAmount: 1024,
    storageAmount: 1024,
    group: mockGroup
};
describe("useLeaseQuery", function () {
    describe("useDeploymentLeaseList", function () {
        it("should return null when deployment is not provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = (0, query_client_1.setupQuery)(function () { return (0, useLeaseQuery_1.useDeploymentLeaseList)("test-address", null); }, {
                            services: {
                                chainApiHttpClient: function () { return (0, jest_mock_extended_1.mock)(); }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.data).toBeNull();
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should fetch leases when deployment is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var chainApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chainApiHttpClient = (0, jest_mock_extended_1.mock)({
                            get: jest.fn().mockResolvedValue({
                                data: {
                                    leases: mockLeases,
                                    pagination: { next_key: null, total: mockLeases.length }
                                }
                            })
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useLeaseQuery_1.useDeploymentLeaseList)("test-address", mockDeployment); }, {
                            services: {
                                chainApiHttpClient: function () { return chainApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining("filters.dseq=".concat(mockDeployment.dseq)));
                        expect(result.current.data).toEqual([(0, deploymentDetailUtils_1.leaseToDto)(mockLeases[0], mockDeployment)]);
                        return [2 /*return*/];
                }
            });
        }); });
        it("should provide a remove function that clears the query", function () { return __awaiter(void 0, void 0, void 0, function () {
            var chainApiHttpClient, result, queryKey, queriesBefore, queriesAfter;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chainApiHttpClient = (0, jest_mock_extended_1.mock)({
                            get: jest.fn().mockResolvedValue({
                                data: {
                                    leases: mockLeases,
                                    pagination: { next_key: null, total: mockLeases.length }
                                }
                            })
                        });
                        result = (0, query_client_1.setupQuery)(function () {
                            var deploymentList = (0, useLeaseQuery_1.useDeploymentLeaseList)("test-address", mockDeployment);
                            var queryClient = (0, react_query_1.useQueryClient)();
                            return { deploymentList: deploymentList, queryClient: queryClient };
                        }, {
                            services: {
                                chainApiHttpClient: function () { return chainApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.deploymentList.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        queryKey = queryKeys_1.QueryKeys.getLeasesKey("test-address", mockDeployment.dseq);
                        queriesBefore = result.current.queryClient.getQueryCache().findAll({ queryKey: queryKey });
                        expect(queriesBefore).toHaveLength(1);
                        (0, react_1.act)(function () {
                            result.current.deploymentList.remove();
                        });
                        queriesAfter = result.current.queryClient.getQueryCache().findAll({ queryKey: queryKey });
                        expect(queriesAfter).toHaveLength(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("useAllLeases", function () {
        it("should return null when address is not provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = (0, query_client_1.setupQuery)(function () { return (0, useLeaseQuery_1.useAllLeases)(""); }, {
                            services: {
                                chainApiHttpClient: function () { return (0, jest_mock_extended_1.mock)(); }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.data).toBeNull();
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should fetch all leases when address is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var chainApiHttpClient, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chainApiHttpClient = (0, jest_mock_extended_1.mock)({
                            get: jest.fn().mockResolvedValue({
                                data: {
                                    leases: mockLeases,
                                    pagination: { next_key: null, total: mockLeases.length }
                                }
                            })
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useLeaseQuery_1.useAllLeases)("test-address"); }, {
                            services: {
                                chainApiHttpClient: function () { return chainApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining("filters.owner=test-address"));
                        expect(result.current.data).toEqual([(0, deploymentDetailUtils_1.leaseToDto)(mockLeases[0], undefined)]);
                        return [2 /*return*/];
                }
            });
        }); });
        it("should use the correct query key", function () { return __awaiter(void 0, void 0, void 0, function () {
            var chainApiHttpClient, result, queryCache, queries;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        chainApiHttpClient = (0, jest_mock_extended_1.mock)({
                            get: jest.fn().mockResolvedValue({
                                data: {
                                    leases: mockLeases,
                                    pagination: { next_key: null, total: mockLeases.length }
                                }
                            })
                        });
                        result = (0, query_client_1.setupQuery)(function () {
                            var leases = (0, useLeaseQuery_1.useAllLeases)("test-address");
                            var queryClient = (0, react_query_1.useQueryClient)();
                            return { leases: leases, queryClient: queryClient };
                        }, {
                            services: {
                                chainApiHttpClient: function () { return chainApiHttpClient; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.leases.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        queryCache = result.current.queryClient.getQueryCache();
                        queries = queryCache.findAll();
                        expect(queries[0].queryKey).toContain("ALL_LEASES");
                        expect(queries[0].queryKey).toContain("test-address");
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe("useLeaseStatus", function () {
        it("returns null when lease is not provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = setupLeaseStatus().result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.data).toBeNull();
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("returns null when local cert is not provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = setupLeaseStatus({
                            lease: mockLease,
                            providerCredentials: {
                                type: "mtls",
                                value: null,
                                isExpired: false,
                                usable: false
                            },
                            services: {
                                providerProxy: function () { return (0, jest_mock_extended_1.mock)(); }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.data).toBeNull();
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("fetches lease status when certificate is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var provider, providerProxy, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        provider = (0, provider_1.buildProvider)();
                        providerProxy = (0, jest_mock_extended_1.mock)({
                            request: jest.fn().mockResolvedValue({ data: mockLeaseStatus })
                        });
                        result = setupLeaseStatus({
                            provider: provider,
                            lease: mockLease,
                            providerCredentials: {
                                type: "mtls",
                                value: {
                                    cert: "certPem",
                                    key: "keyPem"
                                },
                                isExpired: false,
                                usable: true
                            },
                            services: {
                                providerProxy: function () { return providerProxy; }
                            }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(result.current.isSuccess).toBe(true);
                            })];
                    case 1:
                        _a.sent();
                        expect(providerProxy.request).toHaveBeenCalledWith(expect.stringContaining("/lease/".concat(mockLease.dseq, "/").concat(mockLease.gseq, "/").concat(mockLease.oseq, "/status")), expect.objectContaining({
                            method: "GET",
                            providerIdentity: provider
                        }));
                        expect(result.current.data).toEqual(mockLeaseStatus);
                        return [2 /*return*/];
                }
            });
        }); });
        function setupLeaseStatus(input) {
            var _this = this;
            var dependencies = __assign(__assign({}, useLeaseQuery_1.USE_LEASE_STATUS_DEPENDENCIES), { useProviderCredentials: function () {
                    var _a;
                    return ({
                        details: (_a = input === null || input === void 0 ? void 0 : input.providerCredentials) !== null && _a !== void 0 ? _a : {
                            type: "mtls",
                            value: {
                                cert: "certPem",
                                key: "keyPem"
                            },
                            isExpired: false,
                            usable: true
                        },
                        generate: jest.fn(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/];
                        }); }); })
                    });
                } });
            return (0, query_client_1.setupQuery)(function () { return (0, useLeaseQuery_1.useLeaseStatus)({ provider: (input === null || input === void 0 ? void 0 : input.provider) || (0, provider_1.buildProvider)(), lease: input === null || input === void 0 ? void 0 : input.lease, dependencies: dependencies }); }, {
                services: __assign({ providerProxy: function () { return (0, jest_mock_extended_1.mock)(); }, certificatesService: function () { return (0, jest_mock_extended_1.mock)(); } }, input === null || input === void 0 ? void 0 : input.services)
            });
        }
    });
});
