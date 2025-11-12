"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePaymentPolling = exports.PaymentPollingProvider = exports.DEPENDENCIES = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var notistack_1 = require("notistack");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useManagedWallet_1 = require("@src/hooks/useManagedWallet");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var POLLING_INTERVAL_MS = 2000;
var MAX_POLLING_DURATION_MS = 30000;
var MAX_ATTEMPTS = MAX_POLLING_DURATION_MS / POLLING_INTERVAL_MS;
exports.DEPENDENCIES = {
    useWallet: WalletProvider_1.useWallet,
    useWalletBalance: useWalletBalance_1.useWalletBalance,
    useManagedWallet: useManagedWallet_1.useManagedWallet,
    useServices: ServicesProvider_1.useServices,
    useSnackbar: notistack_1.useSnackbar,
    Snackbar: components_1.Snackbar
};
var PaymentPollingContext = (0, react_1.createContext)(null);
var PaymentPollingProvider = function (_a) {
    var children = _a.children, _b = _a.dependencies, d = _b === void 0 ? exports.DEPENDENCIES : _b;
    var wasTrialing = d.useWallet().isTrialing;
    var _c = d.useWalletBalance(), currentBalance = _c.balance, refetchBalance = _c.refetch, isBalanceLoading = _c.isLoading;
    var _d = d.useManagedWallet(), refetchManagedWallet = _d.refetch, isManagedWalletFetching = _d.isFetching;
    var _e = d.useSnackbar(), enqueueSnackbar = _e.enqueueSnackbar, closeSnackbar = _e.closeSnackbar;
    var analyticsService = d.useServices().analyticsService;
    var _f = react_1.default.useState(false), isPolling = _f[0], setIsPolling = _f[1];
    var pollingTimeoutRef = (0, react_1.useRef)(null);
    var isPollingRef = (0, react_1.useRef)(false);
    var attemptCountRef = (0, react_1.useRef)(0);
    var initialBalanceRef = (0, react_1.useRef)(null);
    var wasTrialingRef = (0, react_1.useRef)(wasTrialing);
    var initialTrialingRef = (0, react_1.useRef)(wasTrialing);
    var loadingSnackbarKeyRef = (0, react_1.useRef)(null);
    var closeLoadingSnackbar = (0, react_1.useCallback)(function () {
        if (loadingSnackbarKeyRef.current) {
            closeSnackbar(loadingSnackbarKeyRef.current);
            loadingSnackbarKeyRef.current = null;
        }
    }, [closeSnackbar, loadingSnackbarKeyRef]);
    var stopPolling = (0, react_1.useCallback)(function () {
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
        }
        isPollingRef.current = false;
        attemptCountRef.current = 0;
        setIsPolling(false);
        initialBalanceRef.current = null;
        initialTrialingRef.current = wasTrialing;
        closeLoadingSnackbar();
    }, [closeLoadingSnackbar, wasTrialing]);
    var executePoll = (0, react_1.useCallback)(function () {
        attemptCountRef.current++;
        if (attemptCountRef.current > MAX_ATTEMPTS) {
            stopPolling();
            enqueueSnackbar(<d.Snackbar title="Payment processing timeout" subTitle="Please refresh the page to check your balance" iconVariant="warning"/>, {
                variant: "warning"
            });
            return;
        }
        refetchBalance();
        refetchManagedWallet();
    }, [stopPolling, enqueueSnackbar, refetchBalance, refetchManagedWallet, d]);
    var pollForPayment = (0, react_1.useCallback)(function (initialBalance) {
        var _a;
        if (isPolling) {
            return;
        }
        var balanceToUse = (_a = initialBalance !== null && initialBalance !== void 0 ? initialBalance : currentBalance === null || currentBalance === void 0 ? void 0 : currentBalance.totalUsd) !== null && _a !== void 0 ? _a : null;
        initialBalanceRef.current = balanceToUse;
        initialTrialingRef.current = wasTrialing;
        isPollingRef.current = true;
        attemptCountRef.current = 0;
        setIsPolling(true);
        var loadingSnackbarKey = enqueueSnackbar(<d.Snackbar title="Processing payment..." subTitle="Please wait while we update your balance" showLoading/>, {
            variant: "info",
            autoHideDuration: null,
            persist: true
        });
        loadingSnackbarKeyRef.current = loadingSnackbarKey;
        // Start the first poll immediately
        executePoll();
    }, [isPolling, currentBalance, executePoll, enqueueSnackbar, wasTrialing, d]);
    (0, react_1.useEffect)(function updateWasTrialingRef() {
        wasTrialingRef.current = wasTrialing;
    }, [wasTrialing]);
    (0, react_1.useEffect)(function handleRefetchCompletion() {
        if (!isPolling) {
            return;
        }
        if (!isBalanceLoading && !isManagedWalletFetching) {
            // Schedule next poll if still polling
            if (isPollingRef.current) {
                // Clear any existing timeout to prevent multiple timers
                if (pollingTimeoutRef.current) {
                    clearTimeout(pollingTimeoutRef.current);
                    pollingTimeoutRef.current = null;
                }
                pollingTimeoutRef.current = setTimeout(function () {
                    if (isPollingRef.current) {
                        executePoll();
                    }
                }, POLLING_INTERVAL_MS);
            }
        }
    }, [isPolling, isBalanceLoading, isManagedWalletFetching, executePoll]);
    (0, react_1.useEffect)(function checkForPaymentCompletion() {
        if (!isPolling || !currentBalance || initialBalanceRef.current == null) {
            return;
        }
        var currentTotalBalance = currentBalance.totalUsd;
        var initialBalanceValue = initialBalanceRef.current;
        if (currentTotalBalance > initialBalanceValue) {
            closeLoadingSnackbar();
            enqueueSnackbar(<d.Snackbar title="Payment successful!" subTitle="Your balance has been updated" iconVariant="success"/>, { variant: "success" });
            // Track analytics for trial users after stopping polling
            if (initialTrialingRef.current) {
                analyticsService.track("trial_completed", {
                    category: "user",
                    label: "First payment completed"
                });
            }
            else {
                stopPolling();
            }
        }
    }, [isPolling, currentBalance, stopPolling, enqueueSnackbar, analyticsService, d, closeLoadingSnackbar]);
    (0, react_1.useEffect)(function checkForTrialStatusChange() {
        if (!isPolling || !initialTrialingRef.current) {
            return;
        }
        if (initialTrialingRef.current && !wasTrialing) {
            stopPolling();
            enqueueSnackbar(<d.Snackbar title="Welcome to Akash!" subTitle="Your trial has been completed. You now have full access to the platform." iconVariant="success"/>, { variant: "success", autoHideDuration: 10000 });
        }
    }, [isPolling, wasTrialing, stopPolling, enqueueSnackbar, d]);
    (0, react_1.useEffect)(function stopPollingOnUnmount() {
        return function () {
            stopPolling();
        };
    }, [stopPolling]);
    var contextValue = {
        pollForPayment: pollForPayment,
        stopPolling: stopPolling,
        isPolling: isPolling
    };
    return <PaymentPollingContext.Provider value={contextValue}>{children}</PaymentPollingContext.Provider>;
};
exports.PaymentPollingProvider = PaymentPollingProvider;
var usePaymentPolling = function () {
    var context = (0, react_1.useContext)(PaymentPollingContext);
    if (!context) {
        throw new Error("usePaymentPolling must be used within a PaymentPollingProvider");
    }
    return context;
};
exports.usePaymentPolling = usePaymentPolling;
