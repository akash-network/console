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
exports.ProviderRawData = exports.COMPONENTS = void 0;
var react_1 = require("react");
var DynamicJsonView_1 = require("@src/components/shared/DynamicJsonView");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../../layout/Layout");
var CustomNextSeo_1 = require("../../shared/CustomNextSeo");
var ProviderDetailLayout_1 = require("../ProviderDetailLayout");
exports.COMPONENTS = {
    Layout: Layout_1.default,
    CustomNextSeo: CustomNextSeo_1.CustomNextSeo,
    ProviderDetailLayout: ProviderDetailLayout_1.default,
    DynamicReactJson: DynamicJsonView_1.DynamicReactJson
};
var ProviderRawData = function (_a) {
    var owner = _a.owner, _b = _a.components, c = _b === void 0 ? exports.COMPONENTS : _b;
    var _c = (0, react_1.useState)(null), provider = _c[0], setProvider = _c[1];
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
            var numberOfDeployments_1 = (leases === null || leases === void 0 ? void 0 : leases.filter(function (d) { return d.provider === owner; }).length) || 0;
            var numberOfActiveLeases_1 = (leases === null || leases === void 0 ? void 0 : leases.filter(function (d) { return d.provider === owner && d.state === "active"; }).length) || 0;
            setProvider(function (provider) { return (__assign(__assign({}, provider), { userLeases: numberOfDeployments_1, userActiveLeases: numberOfActiveLeases_1 })); });
        }
    }, [leases]);
    var refresh = function () {
        getProviderDetail();
        getLeases();
        getProviderStatus();
    };
    return (<c.Layout isLoading={isLoadingLeases || isLoadingProvider || isLoadingStatus}>
      <c.CustomNextSeo title={"Provider raw data for ".concat(owner)} url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.providerDetailRaw(owner))}/>

      <c.ProviderDetailLayout address={owner} page={ProviderDetailLayout_1.ProviderDetailTabs.RAW} refresh={refresh} provider={provider}>
        {provider && <c.DynamicReactJson src={JSON.parse(JSON.stringify(provider))} collapsed={1}/>}
      </c.ProviderDetailLayout>
    </c.Layout>);
};
exports.ProviderRawData = ProviderRawData;
