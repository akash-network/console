"use strict";
"use client";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeContainer = HomeContainer;
var react_1 = require("react");
var react_2 = require("react");
var dynamic_1 = require("next/dynamic");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var useDeploymentQuery_1 = require("@src/queries/useDeploymentQuery");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var Layout_1 = require("../layout/Layout");
var WelcomePanel_1 = require("./WelcomePanel");
var YourAccount = (0, dynamic_1.default)(function () { return Promise.resolve().then(function () { return require("./YourAccount"); }); }, {
    ssr: false
});
function HomeContainer() {
    var _a = (0, WalletProvider_1.useWallet)(), address = _a.address, isWalletLoaded = _a.isWalletLoaded;
    var _b = (0, react_1.useState)([]), activeDeployments = _b[0], setActiveDeployments = _b[1];
    var getDeploymentName = (0, LocalNoteProvider_1.useLocalNotes)().getDeploymentName;
    var _c = (0, useDeploymentQuery_1.useDeploymentList)(address, {
        enabled: false
    }), deployments = _c.data, isLoadingDeployments = _c.isFetching, getDeployments = _c.refetch;
    (0, react_1.useEffect)(function () {
        if (deployments) {
            setActiveDeployments(deployments
                ? __spreadArray([], deployments, true).filter(function (d) { return d.state === "active"; })
                    .map(function (d) {
                    var name = getDeploymentName(d.dseq);
                    return __assign(__assign({}, d), { name: name });
                })
                : []);
        }
    }, [deployments, getDeploymentName]);
    var _d = (0, SettingsProvider_1.useSettings)(), settings = _d.settings, isSettingsInit = _d.isSettingsInit;
    var apiEndpoint = settings.apiEndpoint;
    var _e = (0, useWalletBalance_1.useWalletBalance)(), walletBalance = _e.balance, isLoadingBalances = _e.isLoading;
    var _f = (0, useProvidersQuery_1.useProviderList)(), providers = _f.data, isLoadingProviders = _f.isFetching;
    var _g = (0, useLeaseQuery_1.useAllLeases)(address, { enabled: false }), leases = _g.data, isLoadingLeases = _g.isFetching, getLeases = _g.refetch;
    (0, react_1.useEffect)(function () {
        if (address && isSettingsInit) {
            getLeases();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, isSettingsInit]);
    (0, react_1.useEffect)(function () {
        if (isWalletLoaded && isSettingsInit) {
            getDeployments();
        }
    }, [isSettingsInit, isWalletLoaded, getDeployments, apiEndpoint, address]);
    return (<Layout_1.default containerClassName="flex h-full flex-col justify-between" isLoading={isLoadingDeployments || isLoadingBalances || isLoadingProviders || isLoadingLeases}>
      <div>
        <div className="mb-4">
          <WelcomePanel_1.WelcomePanel />
        </div>
        {isSettingsInit && !!address && (<YourAccount isLoadingBalances={isLoadingBalances} walletBalance={walletBalance} activeDeployments={activeDeployments} leases={leases} providers={providers}/>)}
      </div>
    </Layout_1.default>);
}
