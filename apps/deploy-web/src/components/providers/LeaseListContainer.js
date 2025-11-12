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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaseListContainer = void 0;
var react_1 = require("react");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var CustomNextSeo_1 = require("../shared/CustomNextSeo");
var LeaseList_1 = require("./LeaseList");
var ProviderDetailLayout_1 = require("./ProviderDetailLayout");
var LeaseListContainer = function (_a) {
    var owner = _a.owner;
    var _b = (0, react_1.useState)(null), provider = _b[0], setProvider = _b[1];
    var _c = (0, react_1.useState)(null), filteredLeases = _c[0], setFilteredLeases = _c[1];
    var _d = (0, useProvidersQuery_1.useProviderDetail)(owner, {
        enabled: false,
        retry: false
    }), providerDetail = _d.data, isLoadingProvider = _d.isLoading, getProviderDetail = _d.refetch;
    (0, react_1.useEffect)(function () {
        if (providerDetail) {
            setProvider(function (provider) { return (provider ? __assign(__assign({}, provider), providerDetail) : providerDetail); });
        }
    }, [providerDetail]);
    var address = (0, WalletProvider_1.useWallet)().address;
    var _e = (0, useLeaseQuery_1.useAllLeases)(address, { enabled: false }), leases = _e.data, isLoadingLeases = _e.isFetching, getLeases = _e.refetch;
    var _f = (0, useProvidersQuery_1.useProviderStatus)(provider, {
        enabled: false,
        retry: false
    }), providerStatus = _f.data, isLoadingStatus = _f.isLoading, getProviderStatus = _f.refetch;
    (0, react_1.useEffect)(function () {
        if (providerStatus) {
            setProvider(function (provider) { return (provider ? __assign(__assign({}, provider), providerStatus) : providerStatus); });
        }
    }, [providerStatus]);
    (0, react_1.useEffect)(function () {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    (0, react_1.useEffect)(function () {
        if (leases) {
            var numberOfDeployments = (leases === null || leases === void 0 ? void 0 : leases.filter(function (d) { return d.provider === owner; }).length) || 0;
            var numberOfActiveLeases = (leases === null || leases === void 0 ? void 0 : leases.filter(function (d) { return d.provider === owner && d.state === "active"; }).length) || 0;
            setProvider(__assign(__assign({}, provider), { userLeases: numberOfDeployments, userActiveLeases: numberOfActiveLeases }));
        }
    }, [leases]);
    var refresh = function () {
        getProviderDetail();
        getLeases();
        getProviderStatus();
    };
    (0, react_1.useEffect)(function () {
        if (provider && leases && leases.length > 0) {
            var _leases = leases === null || leases === void 0 ? void 0 : leases.filter(function (d) { return d.provider === provider.owner; });
            setFilteredLeases(_leases);
        }
    }, [leases, provider]);
    return (<Layout_1.default isLoading={isLoadingLeases || isLoadingProvider || isLoadingStatus}>
      <CustomNextSeo_1.CustomNextSeo title={"Provider leases for ".concat(owner)} url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.providerDetailLeases(owner))}/>

      <ProviderDetailLayout_1.default address={owner} page={ProviderDetailLayout_1.ProviderDetailTabs.LEASES} refresh={refresh} provider={provider}>
        <LeaseList_1.LeaseList isLoadingLeases={isLoadingLeases} leases={filteredLeases}/>
      </ProviderDetailLayout_1.default>
    </Layout_1.default>);
};
exports.LeaseListContainer = LeaseListContainer;
