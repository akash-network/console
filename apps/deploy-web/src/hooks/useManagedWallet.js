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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useManagedWallet = void 0;
var react_1 = require("react");
var jotai_1 = require("jotai");
var browser_env_config_1 = require("@src/config/browser-env.config");
var CustomChainProvider_1 = require("@src/context/CustomChainProvider");
var useUser_1 = require("@src/hooks/useUser");
var useManagedWalletQuery_1 = require("@src/queries/useManagedWalletQuery");
var walletStore_1 = require("@src/store/walletStore");
var walletUtils_1 = require("@src/utils/walletUtils");
var useCustomUser_1 = require("./useCustomUser");
var NEXT_PUBLIC_BILLING_ENABLED = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED;
var isBillingEnabled = NEXT_PUBLIC_BILLING_ENABLED;
var useManagedWallet = function () {
    var user = (0, useUser_1.useUser)().user;
    var signedInUser = (0, useCustomUser_1.useCustomUser)().user;
    var userWallet = (0, CustomChainProvider_1.useSelectedChain)();
    var _a = (0, jotai_1.useAtom)(walletStore_1.default.selectedWalletType), selectedWalletType = _a[0], setSelectedWalletType = _a[1];
    var _b = (0, useManagedWalletQuery_1.useManagedWalletQuery)(isBillingEnabled ? user === null || user === void 0 ? void 0 : user.id : undefined), queried = _b.data, isFetched = _b.isFetched, isInitialLoading = _b.isLoading, isFetching = _b.isFetching, refetch = _b.refetch;
    var _c = (0, useManagedWalletQuery_1.useCreateManagedWalletMutation)(), create = _c.mutate, created = _c.data, isCreating = _c.isPending, isCreated = _c.isSuccess, createError = _c.error;
    var wallet = (0, react_1.useMemo)(function () { return (queried || created); }, [queried, created]);
    var isLoading = isInitialLoading || isCreating;
    var _d = (0, jotai_1.useAtom)(walletStore_1.default.isSignedInWithTrial), setIsSignedInWithTrial = _d[1];
    var selected = (0, walletUtils_1.getSelectedStorageWallet)();
    (0, react_1.useEffect)(function () {
        if (selectedWalletType === "custodial" && queried && !userWallet.isWalletConnected && !userWallet.isWalletConnecting) {
            setSelectedWalletType("managed");
        }
    }, [queried, selectedWalletType, setSelectedWalletType, userWallet.isWalletConnected, userWallet.isWalletConnecting]);
    (0, react_1.useEffect)(function () {
        if ((signedInUser === null || signedInUser === void 0 ? void 0 : signedInUser.id) && (!!queried || !!created)) {
            setIsSignedInWithTrial(true);
        }
    }, [signedInUser === null || signedInUser === void 0 ? void 0 : signedInUser.id, queried, created, setIsSignedInWithTrial]);
    (0, react_1.useEffect)(function () {
        if (!isBillingEnabled) {
            return;
        }
        if (wallet && isCreated) {
            (0, walletUtils_1.updateStorageManagedWallet)(__assign(__assign({}, wallet), { selected: true }));
        }
        else if (isFetched && !wallet) {
            (0, walletUtils_1.deleteManagedWalletFromStorage)();
        }
        else if (wallet) {
            (0, walletUtils_1.updateStorageManagedWallet)(wallet);
        }
    }, [isFetched, isCreated, wallet]);
    (0, react_1.useEffect)(function () {
        if ((user === null || user === void 0 ? void 0 : user.id) && !user.userId) {
            (0, walletUtils_1.ensureUserManagedWalletOwnership)(user.id);
        }
    }, [user]);
    return (0, react_1.useMemo)(function () {
        var isConfigured = !!wallet;
        return {
            create: function () {
                if (!isBillingEnabled) {
                    throw new Error("Billing is not enabled");
                }
                if (!(user === null || user === void 0 ? void 0 : user.id)) {
                    throw new Error("User is not initialized yet");
                }
                create(user.id);
            },
            wallet: wallet
                ? __assign(__assign({}, wallet), { username: wallet.username, isWalletConnected: isConfigured, isWalletLoaded: isConfigured, selected: (selected === null || selected === void 0 ? void 0 : selected.address) === wallet.address }) : undefined,
            isLoading: isLoading,
            isFetching: isFetching,
            createError: createError,
            refetch: refetch
        };
    }, [wallet, selected === null || selected === void 0 ? void 0 : selected.address, isLoading, isFetching, createError, refetch, user === null || user === void 0 ? void 0 : user.id, create]);
};
exports.useManagedWallet = useManagedWallet;
