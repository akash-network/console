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
var react_query_1 = require("@tanstack/react-query");
var jest_mock_extended_1 = require("jest-mock-extended");
var useManagedWalletQuery_1 = require("./useManagedWalletQuery");
var react_1 = require("@testing-library/react");
var query_client_1 = require("@tests/unit/query-client");
describe(useManagedWalletQuery_1.useManagedWalletQuery.name, function () {
    describe(useManagedWalletQuery_1.useManagedWalletQuery.name, function () {
        it("should fetch wallet when userId is provided", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, managedWalletService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockData = {
                            userId: faker_1.faker.string.uuid(),
                            address: faker_1.faker.finance.ethereumAddress()
                        };
                        managedWalletService = (0, jest_mock_extended_1.mock)({
                            getWallet: jest.fn().mockResolvedValue(mockData)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, useManagedWalletQuery_1.useManagedWalletQuery)(mockData.userId); }, {
                            services: { managedWalletService: function () { return managedWalletService; } }
                        }).result;
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(managedWalletService.getWallet).toHaveBeenCalledWith(mockData.userId);
                                expect(result.current.isSuccess).toBe(true);
                                expect(result.current.data).toEqual(mockData);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should not fetch when userId is not provided", function () {
            var managedWalletService = (0, jest_mock_extended_1.mock)({
                getWallet: jest.fn().mockResolvedValue({})
            });
            var result = (0, query_client_1.setupQuery)(function () { return (0, useManagedWalletQuery_1.useManagedWalletQuery)(); }, {
                services: { managedWalletService: function () { return managedWalletService; } }
            }).result;
            expect(managedWalletService.getWallet).not.toHaveBeenCalled();
            expect(result.current.isLoading).toBe(false);
        });
    });
    describe(useManagedWalletQuery_1.useCreateManagedWalletMutation.name, function () {
        it("should create wallet and update query cache", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockData, mockManagedWalletService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockData = {
                            userId: faker_1.faker.string.uuid(),
                            address: faker_1.faker.finance.ethereumAddress()
                        };
                        mockManagedWalletService = (0, jest_mock_extended_1.mock)({
                            createWallet: jest.fn().mockResolvedValue(mockData)
                        });
                        result = (0, query_client_1.setupQuery)(function () {
                            var mutation = (0, useManagedWalletQuery_1.useCreateManagedWalletMutation)();
                            var queryClient = (0, react_query_1.useQueryClient)();
                            return { mutation: mutation, queryClient: queryClient };
                        }, {
                            services: { managedWalletService: function () { return mockManagedWalletService; } }
                        }).result;
                        return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, result.current.mutation.mutateAsync(mockData.userId)];
                            }); }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(mockManagedWalletService.createWallet).toHaveBeenCalledWith(mockData.userId);
                                expect(result.current.mutation.isSuccess).toBe(true);
                                expect(result.current.queryClient.getQueryData(["MANAGED_WALLET", mockData.userId])).toEqual(mockData);
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
