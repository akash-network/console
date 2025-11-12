"use strict";
"use client";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectManagedWalletButton = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var navigation_1 = require("next/navigation");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useFlag_1 = require("@src/hooks/useFlag");
var urlUtils_1 = require("@src/utils/urlUtils");
var DEPENDENCIES = {
    useFlag: useFlag_1.useFlag,
    useRouter: navigation_1.useRouter,
    useSettings: SettingsProvider_1.useSettings
};
var ConnectManagedWalletButton = function (_a) {
    var _b = _a.className, className = _b === void 0 ? "" : _b, _c = _a.dependencies, d = _c === void 0 ? DEPENDENCIES : _c, rest = __rest(_a, ["className", "dependencies"]);
    var settings = d.useSettings().settings;
    var _d = (0, WalletProvider_1.useWallet)(), connectManagedWallet = _d.connectManagedWallet, hasManagedWallet = _d.hasManagedWallet, isWalletLoading = _d.isWalletLoading;
    var allowAnonymousUserTrial = d.useFlag("anonymous_free_trial");
    var router = d.useRouter();
    var startTrial = (0, react_1.useCallback)(function () {
        if (allowAnonymousUserTrial || hasManagedWallet) {
            connectManagedWallet();
        }
        else {
            router.push(urlUtils_1.UrlService.onboarding());
        }
    }, [connectManagedWallet, allowAnonymousUserTrial, router, hasManagedWallet]);
    return (<components_1.Button variant="outline" onClick={startTrial} className={(0, utils_1.cn)("border-primary bg-primary/10 dark:bg-primary", className)} {...rest} disabled={settings.isBlockchainDown || isWalletLoading}>
      {isWalletLoading ? <components_1.Spinner size="small" className="mr-2" variant="dark"/> : <iconoir_react_1.Rocket className="rotate-45 text-xs"/>}
      <span className="m-2 whitespace-nowrap">{hasManagedWallet ? "Switch to USD Payments" : "Start Trial"}</span>
    </components_1.Button>);
};
exports.ConnectManagedWalletButton = ConnectManagedWalletButton;
