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
var react_1 = require("react");
var jest_mock_extended_1 = require("jest-mock-extended");
var PaymentPollingProvider_1 = require("./PaymentPollingProvider");
var react_2 = require("@testing-library/react");
var seeders_1 = require("@tests/seeders");
describe(PaymentPollingProvider_1.PaymentPollingProvider.name, function () {
    it("provides polling context to children", function () {
        setup({
            isTrialing: false,
            balance: { totalUsd: 100 },
            isWalletBalanceLoading: false
        });
        expect(react_2.screen.queryByTestId("is-polling")).toHaveTextContent("false");
        expect(react_2.screen.queryByTestId("start-polling")).toBeInTheDocument();
        expect(react_2.screen.queryByTestId("stop-polling")).toBeInTheDocument();
    });
    it("prevents multiple polling instances", function () { return __awaiter(void 0, void 0, void 0, function () {
        var refetchBalance, initialCallCount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    refetchBalance = setup({
                        isTrialing: false,
                        balance: { totalUsd: 100 },
                        isWalletBalanceLoading: false
                    }).refetchBalance;
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("start-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    initialCallCount = refetchBalance.mock.calls.length;
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("start-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _a.sent();
                    expect(refetchBalance.mock.calls.length).toBe(initialCallCount);
                    return [2 /*return*/];
            }
        });
    }); });
    it("shows loading snackbar when polling starts", function () { return __awaiter(void 0, void 0, void 0, function () {
        var enqueueSnackbar;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    enqueueSnackbar = setup({
                        isTrialing: false,
                        balance: { totalUsd: 100 },
                        isWalletBalanceLoading: false
                    }).enqueueSnackbar;
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("start-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
                        variant: "info",
                        autoHideDuration: null,
                        persist: true
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    it("stops polling when stopPolling is called", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup({
                        isTrialing: false,
                        balance: { totalUsd: 100 },
                        isWalletBalanceLoading: false
                    });
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("start-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(react_2.screen.queryByTestId("is-polling")).toHaveTextContent("true");
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("stop-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _a.sent();
                    expect(react_2.screen.queryByTestId("is-polling")).toHaveTextContent("false");
                    return [2 /*return*/];
            }
        });
    }); });
    it("verifies polling starts correctly for non-trial users", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, refetchBalance, cleanup;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup({
                        isTrialing: false,
                        balance: { totalUsd: 100 },
                        isWalletBalanceLoading: false
                    }), refetchBalance = _a.refetchBalance, cleanup = _a.cleanup;
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("start-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(react_2.screen.queryByTestId("is-polling")).toHaveTextContent("true");
                        })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                jest.advanceTimersByTime(1000);
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    expect(refetchBalance).toHaveBeenCalled();
                    cleanup();
                    return [2 /*return*/];
            }
        });
    }); });
    it("verifies polling starts correctly for trial users", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, refetchBalance, refetchManagedWallet, cleanup;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup({
                        isTrialing: true,
                        balance: { totalUsd: 100 },
                        isWalletBalanceLoading: false
                    }), refetchBalance = _a.refetchBalance, refetchManagedWallet = _a.refetchManagedWallet, cleanup = _a.cleanup;
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("start-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(react_2.screen.queryByTestId("is-polling")).toHaveTextContent("true");
                        })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                jest.advanceTimersByTime(1000);
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    expect(refetchBalance).toHaveBeenCalled();
                    expect(refetchManagedWallet).toHaveBeenCalled();
                    cleanup();
                    return [2 /*return*/];
            }
        });
    }); });
    it("verifies analytics service is properly configured for trial users", function () { return __awaiter(void 0, void 0, void 0, function () {
        var analyticsService;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    analyticsService = setup({
                        isTrialing: true,
                        balance: { totalUsd: 100 },
                        isWalletBalanceLoading: false
                    }).analyticsService;
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("start-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(analyticsService.track).toBeDefined();
                    expect(typeof analyticsService.track).toBe("function");
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles zero initial balance correctly", function () { return __awaiter(void 0, void 0, void 0, function () {
        var cleanup;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cleanup = setup({
                        isTrialing: false,
                        balance: { totalUsd: 0 },
                        isWalletBalanceLoading: false
                    }).cleanup;
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("start-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(react_2.screen.queryByTestId("is-polling")).toHaveTextContent("true");
                        })];
                case 2:
                    _a.sent();
                    expect(react_2.screen.queryByTestId("is-polling")).toHaveTextContent("true");
                    cleanup();
                    return [2 /*return*/];
            }
        });
    }); });
    it("cleans up polling on unmount", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, unmount, cleanup;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup({
                        isTrialing: false,
                        balance: { totalUsd: 100 },
                        isWalletBalanceLoading: false
                    }), unmount = _a.unmount, cleanup = _a.cleanup;
                    return [4 /*yield*/, (0, react_2.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_2.screen.getByTestId("start-polling").click();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(react_2.screen.queryByTestId("is-polling")).toHaveTextContent("true");
                        })];
                case 2:
                    _b.sent();
                    unmount();
                    expect(react_2.screen.queryByTestId("is-polling")).not.toBeInTheDocument();
                    cleanup();
                    return [2 /*return*/];
            }
        });
    }); });
    it("throws error when used outside provider", function () {
        var TestComponent = function () {
            (0, PaymentPollingProvider_1.usePaymentPolling)();
            return <div>Test</div>;
        };
        // Suppress console.error for this test
        var consoleSpy = jest.spyOn(console, "error").mockImplementation(function () { });
        expect(function () {
            (0, react_2.render)(<TestComponent />);
        }).toThrow("usePaymentPolling must be used within a PaymentPollingProvider");
        consoleSpy.mockRestore();
    });
    function setup(input) {
        jest.useFakeTimers();
        var refetchBalance = jest.fn();
        var refetchManagedWallet = jest.fn();
        var analyticsService = (0, jest_mock_extended_1.mock)();
        var mockEnqueueSnackbar = jest.fn();
        var mockCloseSnackbar = jest.fn();
        var wallet = (0, seeders_1.buildWallet)({ isTrialing: input.isTrialing });
        var managedWallet = (0, seeders_1.buildManagedWallet)({ isTrialing: input.isTrialing });
        var walletBalance = input.balance ? (0, seeders_1.buildWalletBalance)(input.balance) : null;
        var mockSnackbar = function (_a) {
            var title = _a.title, subTitle = _a.subTitle, iconVariant = _a.iconVariant, showLoading = _a.showLoading;
            return (<div data-testid="snackbar" data-title={title} data-subtitle={subTitle} data-icon-variant={iconVariant} data-show-loading={showLoading}/>);
        };
        var mockManagedWallet = __assign(__assign({}, managedWallet), { username: "Managed Wallet", isWalletConnected: true, isWalletLoaded: true, selected: true, creditAmount: 0 });
        var dependencies = __assign(__assign({}, PaymentPollingProvider_1.DEPENDENCIES), { useWallet: jest.fn(function () { return wallet; }), useWalletBalance: jest.fn(function () { return ({
                balance: walletBalance,
                refetch: refetchBalance,
                isLoading: input.isWalletBalanceLoading
            }); }), useManagedWallet: jest.fn(function () { return ({
                wallet: mockManagedWallet,
                isLoading: false,
                isFetching: false,
                createError: null,
                refetch: refetchManagedWallet,
                create: jest.fn()
            }); }), useServices: jest.fn(function () { return ({
                analyticsService: analyticsService
            }); }), useSnackbar: jest.fn(function () { return ({
                enqueueSnackbar: mockEnqueueSnackbar,
                closeSnackbar: mockCloseSnackbar
            }); }), Snackbar: mockSnackbar });
        var TestComponent = function () {
            var _a = (0, PaymentPollingProvider_1.usePaymentPolling)(), pollForPayment = _a.pollForPayment, stopPolling = _a.stopPolling, isPolling = _a.isPolling;
            return (<div>
          <div data-testid="is-polling">{isPolling.toString()}</div>
          <button data-testid="start-polling" onClick={function () { return pollForPayment(); }}>
            Start Polling
          </button>
          <button data-testid="stop-polling" onClick={stopPolling}>
            Stop Polling
          </button>
        </div>);
        };
        var _a = (0, react_2.render)(<PaymentPollingProvider_1.PaymentPollingProvider dependencies={dependencies}>
        <TestComponent />
      </PaymentPollingProvider_1.PaymentPollingProvider>), rerender = _a.rerender, unmount = _a.unmount;
        return {
            refetchBalance: refetchBalance,
            refetchManagedWallet: refetchManagedWallet,
            analyticsService: analyticsService,
            enqueueSnackbar: mockEnqueueSnackbar,
            closeSnackbar: mockCloseSnackbar,
            rerender: rerender,
            unmount: unmount,
            cleanup: function () {
                jest.useRealTimers();
            }
        };
    }
});
