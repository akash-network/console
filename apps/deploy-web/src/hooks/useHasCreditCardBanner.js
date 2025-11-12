"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useHasCreditCardBanner = useHasCreditCardBanner;
var react_1 = require("react");
var jotai_1 = require("jotai");
var browser_env_config_1 = require("@src/config/browser-env.config");
var WalletProvider_1 = require("@src/context/WalletProvider");
var walletStore_1 = require("@src/store/walletStore");
var useUser_1 = require("./useUser");
var withBilling = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED;
function useHasCreditCardBanner() {
    var user = (0, useUser_1.useUser)().user;
    var _a = (0, react_1.useState)(false), isBannerVisible = _a[0], setIsBannerVisible = _a[1];
    var _b = (0, react_1.useState)(false), isInitialized = _b[0], setIsInitialized = _b[1];
    var _c = (0, WalletProvider_1.useWallet)(), hasManagedWallet = _c.hasManagedWallet, isWalletLoading = _c.isWalletLoading;
    var isSignedInWithTrial = (0, jotai_1.useAtom)(walletStore_1.default.isSignedInWithTrial)[0];
    var shouldShowBanner = (0, react_1.useMemo)(function () { return isInitialized && withBilling && !hasManagedWallet && !isWalletLoading && !isSignedInWithTrial; }, [isInitialized, hasManagedWallet, isWalletLoading, isSignedInWithTrial]);
    (0, react_1.useEffect)(function () {
        if (user === null || user === void 0 ? void 0 : user.id) {
            setIsInitialized(true);
        }
    }, [user === null || user === void 0 ? void 0 : user.id]);
    (0, react_1.useEffect)(function () {
        if (shouldShowBanner) {
            setIsBannerVisible(true);
        }
    }, [shouldShowBanner]);
    return isBannerVisible;
}
