"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTrialBalance = void 0;
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useManagedWallet_1 = require("./useManagedWallet");
var useWalletBalance_1 = require("./useWalletBalance");
var useTrialBalance = function () {
    var _a, _b;
    var creditAmount = (0, WalletProvider_1.useWallet)().creditAmount;
    var _c = (0, useWalletBalance_1.useWalletBalance)(), walletBalance = _c.balance, isLoading = _c.isLoading;
    var managedWallet = (0, useManagedWallet_1.useManagedWallet)().wallet;
    var appConfig = (0, ServicesProvider_1.useServices)().appConfig;
    var TRIAL_TOTAL = appConfig.NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT;
    var TRIAL_DURATION_DAYS = appConfig.NEXT_PUBLIC_TRIAL_DURATION_DAYS;
    var creditsRemaining = Math.min(Math.max((_b = (_a = walletBalance === null || walletBalance === void 0 ? void 0 : walletBalance.totalDeploymentGrantsUSD) !== null && _a !== void 0 ? _a : creditAmount) !== null && _b !== void 0 ? _b : TRIAL_TOTAL, 0), TRIAL_TOTAL);
    var creditsUsed = TRIAL_TOTAL - creditsRemaining;
    var remainingPercentage = Math.min(Math.max((creditsRemaining / TRIAL_TOTAL) * 100, 0), 100);
    // Calculate trial end date from wallet creation date
    var now = new Date();
    var trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);
    var timeRemaining = trialEndDate.getTime() - now.getTime();
    var daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
    if (managedWallet === null || managedWallet === void 0 ? void 0 : managedWallet.createdAt) {
        var createdAt = new Date(managedWallet.createdAt);
        trialEndDate = new Date(createdAt);
        trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);
        timeRemaining = trialEndDate.getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
    }
    return {
        total: TRIAL_TOTAL,
        remaining: creditsRemaining,
        used: creditsUsed,
        remainingPercentage: remainingPercentage,
        isLoading: isLoading,
        trialEndDate: trialEndDate,
        daysRemaining: daysRemaining
    };
};
exports.useTrialBalance = useTrialBalance;
