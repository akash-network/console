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
require("@testing-library/jest-dom");
var react_1 = require("react");
var test_utils_1 = require("react-dom/test-utils");
var PaymentMethodContainer_1 = require("./PaymentMethodContainer");
var react_2 = require("@testing-library/react");
describe("PaymentMethodContainer", function () {
    it("should render children with initial state", function () {
        var child = setup().child;
        expect(child).toHaveBeenCalledWith(expect.objectContaining({
            setupIntent: undefined,
            paymentMethods: [],
            showAddForm: false,
            showDeleteConfirmation: false,
            cardToDelete: undefined,
            isConnectingWallet: false,
            isLoading: false,
            isRemoving: false,
            onSuccess: expect.any(Function),
            onRemovePaymentMethod: expect.any(Function),
            onConfirmRemovePaymentMethod: expect.any(Function),
            onNext: expect.any(Function),
            onShowAddForm: expect.any(Function),
            onShowDeleteConfirmation: expect.any(Function),
            onSetCardToDelete: expect.any(Function),
            refetchPaymentMethods: expect.any(Function)
        }));
    });
    it("should create setup intent on mount", function () {
        var mockCreateSetupIntent = setup().mockCreateSetupIntent;
        expect(mockCreateSetupIntent).toHaveBeenCalled();
    });
    it("should handle payment method removal", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockRemovePaymentMethod, onRemovePaymentMethod, onConfirmRemovePaymentMethod;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockRemovePaymentMethod = _a.mockRemovePaymentMethod;
                    mockRemovePaymentMethod.mockResolvedValue(undefined);
                    onRemovePaymentMethod = child.mock.calls[0][0].onRemovePaymentMethod;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                onRemovePaymentMethod("pm_123");
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    onConfirmRemovePaymentMethod = child.mock.calls[child.mock.calls.length - 1][0].onConfirmRemovePaymentMethod;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onConfirmRemovePaymentMethod()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _b.sent();
                    expect(mockRemovePaymentMethod).toHaveBeenCalledWith("pm_123");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle payment method removal error", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockRemovePaymentMethod, onRemovePaymentMethod, onConfirmRemovePaymentMethod;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockRemovePaymentMethod = _a.mockRemovePaymentMethod;
                    mockRemovePaymentMethod.mockRejectedValue(new Error("Failed to remove"));
                    onRemovePaymentMethod = child.mock.calls[0][0].onRemovePaymentMethod;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                onRemovePaymentMethod("pm_123");
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    onConfirmRemovePaymentMethod = child.mock.calls[child.mock.calls.length - 1][0].onConfirmRemovePaymentMethod;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onConfirmRemovePaymentMethod()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    _b.sent();
                    expect(mockRemovePaymentMethod).toHaveBeenCalledWith("pm_123");
                    // State should remain unchanged on error (component doesn't reset state on error)
                    expect(child.mock.calls[child.mock.calls.length - 1][0].showDeleteConfirmation).toBe(true);
                    expect(child.mock.calls[child.mock.calls.length - 1][0].cardToDelete).toBe("pm_123");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle success callback", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockOnComplete, _a, child, mockRefetchPaymentMethods, onSuccess;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockOnComplete = jest.fn();
                    _a = setup({ onComplete: mockOnComplete }), child = _a.child, mockRefetchPaymentMethods = _a.mockRefetchPaymentMethods;
                    onSuccess = child.mock.calls[0][0].onSuccess;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                onSuccess();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockRefetchPaymentMethods).toHaveBeenCalled();
                    // onSuccess only refetches payment methods, doesn't call onComplete
                    expect(mockOnComplete).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle next step with payment methods", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockOnComplete, _a, child, mockCreateWallet, onNext;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockOnComplete = jest.fn();
                    _a = setup({
                        paymentMethods: [{ id: "pm_123", type: "card" }],
                        onComplete: mockOnComplete
                    }), child = _a.child, mockCreateWallet = _a.mockCreateWallet;
                    onNext = child.mock.calls[0][0].onNext;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onNext()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
                    expect(mockOnComplete).toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it("should not proceed when no payment methods exist", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockCreateWallet, onNext;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup({ paymentMethods: [] }), child = _a.child, mockCreateWallet = _a.mockCreateWallet;
                    onNext = child.mock.calls[0][0].onNext;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                onNext();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockCreateWallet).not.toHaveBeenCalled();
                    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle wallet connection state changes", function () {
        var child = setup({
            hasManagedWallet: true,
            isWalletLoading: false
        }).child;
        // Test that the container properly tracks wallet state
        expect(child.mock.calls[0][0].isLoading).toBe(false);
        var loadingChild = setup({
            hasManagedWallet: false,
            isWalletLoading: true
        }).child;
        expect(loadingChild.mock.calls[0][0].isLoading).toBe(true);
    });
    it("should handle state updates correctly", function () {
        var child = setup().child;
        var _a = child.mock.calls[0][0], onShowAddForm = _a.onShowAddForm, onShowDeleteConfirmation = _a.onShowDeleteConfirmation, onSetCardToDelete = _a.onSetCardToDelete;
        (0, test_utils_1.act)(function () {
            onShowAddForm(true);
        });
        expect(child.mock.calls[child.mock.calls.length - 1][0].showAddForm).toBe(true);
        (0, test_utils_1.act)(function () {
            onShowDeleteConfirmation(true);
        });
        expect(child.mock.calls[child.mock.calls.length - 1][0].showDeleteConfirmation).toBe(true);
        (0, test_utils_1.act)(function () {
            onSetCardToDelete("pm_123");
        });
        expect(child.mock.calls[child.mock.calls.length - 1][0].cardToDelete).toBe("pm_123");
    });
    it("should calculate loading state correctly", function () {
        var child = setup({ isWalletLoading: true }).child;
        expect(child.mock.calls[0][0].isLoading).toBe(true);
    });
    it("should pass payment methods data correctly", function () {
        var paymentMethods = [
            { id: "pm_123", type: "card", card: { last4: "1234", brand: "visa" } },
            { id: "pm_456", type: "card", card: { last4: "5678", brand: "mastercard" } }
        ];
        var child = setup({ paymentMethods: paymentMethods }).child;
        expect(child.mock.calls[0][0].paymentMethods).toEqual(paymentMethods);
    });
    it("should pass setup intent data correctly", function () {
        var setupIntent = { client_secret: "seti_123", id: "seti_123" };
        var child = setup({ setupIntent: setupIntent }).child;
        expect(child.mock.calls[0][0].setupIntent).toEqual(setupIntent);
    });
    it("should handle isRemoving state correctly", function () {
        var child = setup({ isRemoving: true }).child;
        expect(child.mock.calls[0][0].isRemoving).toBe(true);
    });
    it("should calculate hasValidatedCard correctly", function () {
        var paymentMethods = [
            { id: "pm_123", type: "card", validated: true },
            { id: "pm_456", type: "card", validated: false }
        ];
        var child = setup({ paymentMethods: paymentMethods }).child;
        expect(child.mock.calls[0][0].hasValidatedCard).toBe(true);
    });
    it("should calculate hasValidatedCard as false when no validated cards", function () {
        var paymentMethods = [
            { id: "pm_123", type: "card", validated: false },
            { id: "pm_456", type: "card", validated: false }
        ];
        var child = setup({ paymentMethods: paymentMethods }).child;
        expect(child.mock.calls[0][0].hasValidatedCard).toBe(false);
    });
    it("should calculate hasPaymentMethod correctly", function () {
        var paymentMethods = [{ id: "pm_123", type: "card" }];
        var child = setup({ paymentMethods: paymentMethods }).child;
        expect(child.mock.calls[0][0].hasPaymentMethod).toBe(true);
    });
    it("should calculate hasPaymentMethod as false when no payment methods", function () {
        var child = setup({ paymentMethods: [] }).child;
        expect(child.mock.calls[0][0].hasPaymentMethod).toBe(false);
    });
    it("should handle wallet creation error", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockOnComplete, _a, child, mockCreateWallet, onNext;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockOnComplete = jest.fn();
                    _a = setup({
                        paymentMethods: [{ id: "pm_123", type: "card" }],
                        onComplete: mockOnComplete
                    }), child = _a.child, mockCreateWallet = _a.mockCreateWallet;
                    mockCreateWallet.mockRejectedValue(new Error("Wallet creation failed"));
                    onNext = child.mock.calls[0][0].onNext;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onNext()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
                    expect(mockOnComplete).not.toHaveBeenCalled();
                    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle wallet creation when user ID is not available", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockOnComplete, _a, child, mockCreateWallet, onNext;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockOnComplete = jest.fn();
                    _a = setup({
                        paymentMethods: [{ id: "pm_123", type: "card" }],
                        onComplete: mockOnComplete,
                        user: null
                    }), child = _a.child, mockCreateWallet = _a.mockCreateWallet;
                    onNext = child.mock.calls[0][0].onNext;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onNext()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockCreateWallet).not.toHaveBeenCalled();
                    expect(mockOnComplete).not.toHaveBeenCalled();
                    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle 3D Secure required scenario", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockOnComplete, _a, child, mockCreateWallet, mockStart3DSecure, onNext;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockOnComplete = jest.fn();
                    _a = setup({
                        paymentMethods: [{ id: "pm_123", type: "card" }],
                        onComplete: mockOnComplete
                    }), child = _a.child, mockCreateWallet = _a.mockCreateWallet, mockStart3DSecure = _a.mockStart3DSecure;
                    mockCreateWallet.mockResolvedValue({
                        requires3DS: true,
                        clientSecret: "cs_test_123",
                        paymentIntentId: "pi_test_123",
                        paymentMethodId: "pm_test_123"
                    });
                    onNext = child.mock.calls[0][0].onNext;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onNext()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
                    expect(mockStart3DSecure).toHaveBeenCalledWith({
                        clientSecret: "cs_test_123",
                        paymentIntentId: "pi_test_123",
                        paymentMethodId: "pm_test_123"
                    });
                    expect(mockOnComplete).not.toHaveBeenCalled();
                    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle 3D Secure validation failure - missing clientSecret", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockOnComplete, _a, child, mockCreateWallet, mockStart3DSecure, onNext;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockOnComplete = jest.fn();
                    _a = setup({
                        paymentMethods: [{ id: "pm_123", type: "card" }],
                        onComplete: mockOnComplete
                    }), child = _a.child, mockCreateWallet = _a.mockCreateWallet, mockStart3DSecure = _a.mockStart3DSecure;
                    mockCreateWallet.mockResolvedValue({
                        requires3DS: true,
                        clientSecret: "",
                        paymentIntentId: "pi_test_123",
                        paymentMethodId: "pm_test_123"
                    });
                    onNext = child.mock.calls[0][0].onNext;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onNext()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
                    expect(mockStart3DSecure).not.toHaveBeenCalled();
                    expect(mockOnComplete).not.toHaveBeenCalled();
                    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle 3D Secure validation failure - missing payment IDs", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockOnComplete, _a, child, mockCreateWallet, mockStart3DSecure, onNext;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mockOnComplete = jest.fn();
                    _a = setup({
                        paymentMethods: [{ id: "pm_123", type: "card" }],
                        onComplete: mockOnComplete
                    }), child = _a.child, mockCreateWallet = _a.mockCreateWallet, mockStart3DSecure = _a.mockStart3DSecure;
                    mockCreateWallet.mockResolvedValue({
                        requires3DS: true,
                        clientSecret: "cs_test_123",
                        paymentIntentId: "",
                        paymentMethodId: ""
                    });
                    onNext = child.mock.calls[0][0].onNext;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onNext()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
                    expect(mockStart3DSecure).not.toHaveBeenCalled();
                    expect(mockOnComplete).not.toHaveBeenCalled();
                    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should pass threeDSecure data correctly", function () {
        var child = setup().child;
        var threeDSecure = child.mock.calls[0][0].threeDSecure;
        expect(threeDSecure).toEqual({
            isOpen: false,
            threeDSData: null,
            start3DSecure: expect.any(Function),
            close3DSecure: expect.any(Function),
            handle3DSSuccess: expect.any(Function),
            handle3DSError: expect.any(Function)
        });
    });
    function setup(input) {
        if (input === void 0) { input = {}; }
        jest.clearAllMocks();
        var mockCreateSetupIntent = jest.fn();
        var mockRefetchPaymentMethods = jest.fn();
        var mockRemovePaymentMethod = jest.fn();
        var mockConnectManagedWallet = jest.fn();
        var mockUseSetupIntentMutation = jest.fn().mockReturnValue({
            data: input.setupIntent,
            mutate: mockCreateSetupIntent
        });
        var mockUsePaymentMethodsQuery = jest.fn().mockReturnValue({
            data: input.paymentMethods || [],
            refetch: mockRefetchPaymentMethods
        });
        var mockUsePaymentMutations = jest.fn().mockReturnValue({
            removePaymentMethod: {
                mutateAsync: mockRemovePaymentMethod,
                isPending: input.isRemoving || false
            }
        });
        var mockUseWallet = jest.fn().mockReturnValue({
            connectManagedWallet: mockConnectManagedWallet,
            isWalletLoading: input.isWalletLoading || false,
            hasManagedWallet: input.hasManagedWallet || false,
            managedWalletError: input.managedWalletError
        });
        var mockCreateWallet = jest.fn().mockResolvedValue({});
        var mockUseCreateManagedWalletMutation = jest.fn().mockReturnValue({
            mutateAsync: mockCreateWallet
        });
        var mockStart3DSecure = jest.fn();
        var mockHandle3DSSuccess = jest.fn();
        var mockHandle3DSError = jest.fn();
        var mockUse3DSecure = jest.fn().mockReturnValue({
            isOpen: false,
            threeDSData: null,
            start3DSecure: mockStart3DSecure,
            close3DSecure: jest.fn(),
            handle3DSSuccess: mockHandle3DSSuccess,
            handle3DSError: mockHandle3DSError
        });
        var mockUseUser = jest.fn().mockReturnValue({
            user: input.user !== undefined ? input.user : { id: "user_123" }
        });
        var dependencies = {
            useWallet: mockUseWallet,
            useUser: mockUseUser,
            usePaymentMethodsQuery: mockUsePaymentMethodsQuery,
            usePaymentMutations: mockUsePaymentMutations,
            useSetupIntentMutation: mockUseSetupIntentMutation,
            useCreateManagedWalletMutation: mockUseCreateManagedWalletMutation,
            use3DSecure: mockUse3DSecure
        };
        var mockChildren = jest.fn().mockReturnValue(<div>Test</div>);
        var mockOnComplete = input.onComplete || jest.fn();
        (0, react_2.render)(<PaymentMethodContainer_1.PaymentMethodContainer onComplete={mockOnComplete} dependencies={dependencies}>
        {mockChildren}
      </PaymentMethodContainer_1.PaymentMethodContainer>);
        return {
            child: mockChildren,
            mockCreateSetupIntent: mockCreateSetupIntent,
            mockRefetchPaymentMethods: mockRefetchPaymentMethods,
            mockRemovePaymentMethod: mockRemovePaymentMethod,
            mockConnectManagedWallet: mockConnectManagedWallet,
            mockCreateWallet: mockCreateWallet,
            mockStart3DSecure: mockStart3DSecure,
            mockHandle3DSSuccess: mockHandle3DSSuccess,
            mockHandle3DSError: mockHandle3DSError,
            mockUseWallet: mockUseWallet,
            mockUsePaymentMethodsQuery: mockUsePaymentMethodsQuery,
            mockUsePaymentMutations: mockUsePaymentMutations,
            mockUseSetupIntentMutation: mockUseSetupIntentMutation
        };
    }
});
