"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useManagedWalletDenom = void 0;
var browser_env_config_1 = require("@src/config/browser-env.config");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useDenom_1 = require("@src/hooks/useDenom");
var useManagedWalletDenom = function () {
    var wallet = (0, WalletProvider_1.useWallet)();
    var usdcDenom = (0, useDenom_1.useUsdcDenom)();
    return wallet.isManaged && browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_DENOM === "usdc" ? usdcDenom : "uakt";
};
exports.useManagedWalletDenom = useManagedWalletDenom;
