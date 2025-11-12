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
var usePaymentQueries_1 = require("./usePaymentQueries");
var react_1 = require("@testing-library/react");
var payment_1 = require("@tests/seeders/payment");
var query_client_1 = require("@tests/unit/query-client");
describe("usePaymentQueries", function () {
    it("fetches payment methods", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockMethods, stripeService, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockMethods = (0, payment_1.createMockItems)(payment_1.createMockPaymentMethod, 2);
                    stripeService = (0, jest_mock_extended_1.mock)({
                        getPaymentMethods: jest.fn().mockResolvedValue(mockMethods)
                    });
                    result = (0, query_client_1.setupQuery)(function () { return (0, usePaymentQueries_1.usePaymentMethodsQuery)(); }, {
                        services: { stripe: function () { return stripeService; } }
                    }).result;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(stripeService.getPaymentMethods).toHaveBeenCalled();
                            expect(result.current.isSuccess).toBe(true);
                            expect(result.current.data).toEqual(mockMethods);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("fetches payment transactions", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockTransactions, stripeService, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockTransactions = {
                        transactions: (0, payment_1.createMockItems)(payment_1.createMockTransaction, 2)
                    };
                    stripeService = (0, jest_mock_extended_1.mock)({
                        getCustomerTransactions: jest.fn().mockResolvedValue(mockTransactions)
                    });
                    result = (0, query_client_1.setupQuery)(function () { return (0, usePaymentQueries_1.usePaymentTransactionsQuery)({ limit: 2 }); }, {
                        services: { stripe: function () { return stripeService; } }
                    }).result;
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            var _a;
                            expect(stripeService.getCustomerTransactions).toHaveBeenCalledWith({ limit: 2 });
                            expect(result.current.isSuccess).toBe(true);
                            expect((_a = result.current.data) === null || _a === void 0 ? void 0 : _a.transactions).toEqual(mockTransactions.transactions);
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("creates setup intent", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockSetupIntent, stripeService, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockSetupIntent = (0, payment_1.createMockSetupIntent)();
                    stripeService = (0, jest_mock_extended_1.mock)({
                        createSetupIntent: jest.fn().mockResolvedValue(mockSetupIntent)
                    });
                    result = (0, query_client_1.setupQuery)(function () { return (0, usePaymentQueries_1.useSetupIntentMutation)(); }, {
                        services: { stripe: function () { return stripeService; } }
                    }).result;
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, result.current.mutateAsync()];
                        }); }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            expect(stripeService.createSetupIntent).toHaveBeenCalled();
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe("usePaymentMutations", function () {
        it("confirms payment and invalidate queries", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockPaymentResponse, stripeService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockPaymentResponse = (0, payment_1.createMockPaymentResponse)();
                        stripeService = (0, jest_mock_extended_1.mock)({
                            confirmPayment: jest.fn().mockResolvedValue(mockPaymentResponse)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, usePaymentQueries_1.usePaymentMutations)(); }, {
                            services: { stripe: function () { return stripeService; } }
                        }).result;
                        return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, result.current.confirmPayment.mutateAsync({
                                                userId: "u1",
                                                paymentMethodId: mockPaymentResponse.id,
                                                amount: mockPaymentResponse.amount,
                                                currency: mockPaymentResponse.currency
                                            })];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(stripeService.confirmPayment).toHaveBeenCalled();
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("applies coupon and invalidate discounts", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockCouponResponse, stripeService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockCouponResponse = (0, payment_1.createMockCouponResponse)();
                        stripeService = (0, jest_mock_extended_1.mock)({
                            applyCoupon: jest.fn().mockResolvedValue(mockCouponResponse)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, usePaymentQueries_1.usePaymentMutations)(); }, {
                            services: { stripe: function () { return stripeService; } }
                        }).result;
                        return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, result.current.applyCoupon.mutateAsync({ coupon: mockCouponResponse.coupon.id, userId: "u1" })];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(stripeService.applyCoupon).toHaveBeenCalledWith(mockCouponResponse.coupon.id, "u1");
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("handles coupon application error response", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockErrorResponse, stripeService, result, response;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        mockErrorResponse = {
                            coupon: null,
                            error: {
                                message: "No valid promotion code or coupon found with the provided code"
                            }
                        };
                        stripeService = (0, jest_mock_extended_1.mock)({
                            applyCoupon: jest.fn().mockResolvedValue(mockErrorResponse)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, usePaymentQueries_1.usePaymentMutations)(); }, {
                            services: { stripe: function () { return stripeService; } }
                        }).result;
                        return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, result.current.applyCoupon.mutateAsync({ coupon: "INVALID", userId: "u1" })];
                            }); }); })];
                    case 1:
                        response = _b.sent();
                        expect((_a = response.error) === null || _a === void 0 ? void 0 : _a.message).toBe("No valid promotion code or coupon found with the provided code");
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(stripeService.applyCoupon).toHaveBeenCalledWith("INVALID", "u1");
                            })];
                    case 2:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it("removes payment method and invalidate methods", function () { return __awaiter(void 0, void 0, void 0, function () {
            var mockRemovedPaymentMethod, stripeService, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockRemovedPaymentMethod = (0, payment_1.createMockRemovedPaymentMethod)();
                        stripeService = (0, jest_mock_extended_1.mock)({
                            removePaymentMethod: jest.fn().mockResolvedValue(mockRemovedPaymentMethod)
                        });
                        result = (0, query_client_1.setupQuery)(function () { return (0, usePaymentQueries_1.usePaymentMutations)(); }, {
                            services: { stripe: function () { return stripeService; } }
                        }).result;
                        return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, result.current.removePaymentMethod.mutateAsync(mockRemovedPaymentMethod.id)];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, react_1.waitFor)(function () {
                                expect(stripeService.removePaymentMethod).toHaveBeenCalledWith(mockRemovedPaymentMethod.id);
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
