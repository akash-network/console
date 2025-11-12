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
exports.getSelectedStorageWallet = getSelectedStorageWallet;
exports.getStorageManagedWallet = getStorageManagedWallet;
exports.updateStorageManagedWallet = updateStorageManagedWallet;
exports.deleteManagedWalletFromStorage = deleteManagedWalletFromStorage;
exports.getStorageWallets = getStorageWallets;
exports.updateWallet = updateWallet;
exports.updateStorageWallets = updateStorageWallets;
exports.deleteWalletFromStorage = deleteWalletFromStorage;
exports.useSelectedWalletFromStorage = useSelectedWalletFromStorage;
exports.ensureUserManagedWalletOwnership = ensureUserManagedWalletOwnership;
var lodash_1 = require("lodash");
var browser_env_config_1 = require("@src/config/browser-env.config");
var networkStore_1 = require("@src/store/networkStore");
function getSelectedStorageWallet() {
    var _a, _b;
    var wallets = getStorageWallets();
    return (_b = (_a = wallets.find(function (w) { return w.selected; })) !== null && _a !== void 0 ? _a : wallets[0]) !== null && _b !== void 0 ? _b : null;
}
function getStorageManagedWallet(networkId) {
    return getStorageWallets(networkId).find(function (wallet) { return wallet.isManaged; });
}
function updateStorageManagedWallet(wallet) {
    var networkId = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
    var wallets = getStorageWallets(networkId);
    var prevIndex = wallets.findIndex(function (_a) {
        var isManaged = _a.isManaged;
        return isManaged;
    });
    var prev = wallets[prevIndex];
    var next = __assign(__assign(__assign({}, prev), wallet), { name: "Managed Wallet", isManaged: true, selected: typeof wallet.selected === "boolean" ? wallet.selected : typeof (prev === null || prev === void 0 ? void 0 : prev.selected) === "boolean" ? prev.selected : false });
    if ((0, lodash_1.isEqual)(prev, next)) {
        return next;
    }
    if (prev && (prev === null || prev === void 0 ? void 0 : prev.address) !== next.address) {
        deleteManagedWalletFromStorage();
    }
    if (next.selected && !(prev === null || prev === void 0 ? void 0 : prev.selected)) {
        wallets.forEach(function (item) {
            item.selected = false;
        });
    }
    if (prevIndex !== -1) {
        wallets.splice(prevIndex, 1, next);
    }
    else {
        wallets.push(next);
    }
    updateStorageWallets(wallets, networkId);
    return next;
}
function deleteManagedWalletFromStorage(networkId) {
    var wallet = getStorageManagedWallet(networkId);
    if (wallet) {
        deleteWalletFromStorage(wallet.address, true, networkId);
    }
}
function getStorageWallets(networkId) {
    if (typeof window === "undefined") {
        return [];
    }
    var selectedNetworkId = networkId || networkStore_1.default.selectedNetworkId;
    var wallets = JSON.parse(localStorage.getItem("".concat(selectedNetworkId, "/wallets")) || "[]");
    return wallets || [];
}
function updateWallet(address, func, networkId) {
    var wallets = getStorageWallets(networkId);
    var wallet = wallets.find(function (w) { return w.address === address; });
    if (wallet) {
        wallet = func(wallet);
        var newWallets = wallets.map(function (w) { return (w.address === address ? wallet : w); });
        updateStorageWallets(newWallets, networkId);
    }
}
function updateStorageWallets(wallets, networkId) {
    var selectedNetworkId = networkId || networkStore_1.default.selectedNetworkId;
    localStorage.setItem("".concat(selectedNetworkId, "/wallets"), JSON.stringify(wallets));
}
function deleteWalletFromStorage(address, deleteDeployments, networkId) {
    var selectedNetworkId = networkId || networkStore_1.default.selectedNetworkId;
    var wallets = getStorageWallets();
    var newWallets = wallets.filter(function (w) { return w.address !== address; }).map(function (w, i) { return (__assign(__assign({}, w), { selected: i === 0 })); });
    updateStorageWallets(newWallets);
    localStorage.removeItem("".concat(selectedNetworkId, "/").concat(address, "/settings"));
    localStorage.removeItem("".concat(selectedNetworkId, "/").concat(address, "/provider.data"));
    if (deleteDeployments) {
        var deploymentKeys = Object.keys(localStorage).filter(function (key) { return key.startsWith("".concat(selectedNetworkId, "/").concat(address, "/deployments/")); });
        for (var _i = 0, deploymentKeys_1 = deploymentKeys; _i < deploymentKeys_1.length; _i++) {
            var deploymentKey = deploymentKeys_1[_i];
            localStorage.removeItem(deploymentKey);
        }
    }
    return newWallets;
}
function useSelectedWalletFromStorage() {
    return getSelectedStorageWallet();
}
function ensureUserManagedWalletOwnership(userId) {
    var wallet = getStorageManagedWallet();
    if ((wallet === null || wallet === void 0 ? void 0 : wallet.userId) !== userId) {
        deleteManagedWalletFromStorage();
    }
}
