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
exports.ProviderDetail = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var styles_1 = require("@mui/material/styles");
var useMediaQuery_1 = require("@mui/material/useMediaQuery");
var date_fns_1 = require("date-fns");
var iconoir_react_1 = require("iconoir-react");
var dynamic_1 = require("next/dynamic");
var LabelValue_1 = require("@src/components/shared/LabelValue");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var CustomNextSeo_1 = require("../shared/CustomNextSeo");
var Title_1 = require("../shared/Title");
var ActiveLeasesGraph_1 = require("./ActiveLeasesGraph");
var ProviderDetailLayout_1 = require("./ProviderDetailLayout");
var ProviderSpecs_1 = require("./ProviderSpecs");
var NetworkCapacity = (0, dynamic_1.default)(function () { return Promise.resolve().then(function () { return require("./NetworkCapacity"); }); }, {
    ssr: false
});
var ProviderDetail = function (_a) {
    var _b, _c;
    var owner = _a.owner, _provider = _a._provider;
    var _d = (0, react_1.useState)(_provider), provider = _d[0], setProvider = _d[1];
    var address = (0, WalletProvider_1.useWallet)().address;
    var _e = (0, useProvidersQuery_1.useProviderDetail)(owner, {
        enabled: false,
        retry: false
    }), providerDetail = _e.data, isLoadingProvider = _e.isLoading, getProviderDetail = _e.refetch;
    (0, react_1.useEffect)(function () {
        if (providerDetail) {
            setProvider(function (provider) { return (__assign(__assign({}, provider), providerDetail)); });
        }
    }, [providerDetail]);
    var _f = (0, useLeaseQuery_1.useAllLeases)(address, { enabled: false }), leases = _f.data, isLoadingLeases = _f.isFetching, getLeases = _f.refetch;
    var _g = (0, useProvidersQuery_1.useProviderAttributesSchema)(), providerAttributesSchema = _g.data, isLoadingSchema = _g.isFetching;
    var _h = (0, useProvidersQuery_1.useProviderStatus)(provider, {
        enabled: true,
        retry: false
    }), providerStatus = _h.data, isLoadingStatus = _h.isLoading, getProviderStatus = _h.refetch;
    (0, react_1.useEffect)(function () {
        if (providerStatus) {
            setProvider(function (provider) { return (__assign(__assign({}, provider), providerStatus)); });
        }
    }, [providerStatus]);
    var isLoading = isLoadingProvider || isLoadingStatus || isLoadingLeases || isLoadingSchema;
    var muiTheme = (0, styles_1.useTheme)();
    var smallScreen = (0, useMediaQuery_1.default)(muiTheme.breakpoints.down("lg"));
    (0, react_1.useEffect)(function () {
        getProviderDetail();
        getLeases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    (0, react_1.useEffect)(function () {
        if (leases) {
            var numberOfDeployments_1 = (leases === null || leases === void 0 ? void 0 : leases.filter(function (d) { return d.provider === owner; }).length) || 0;
            var numberOfActiveLeases_1 = (leases === null || leases === void 0 ? void 0 : leases.filter(function (d) { return d.provider === owner && d.state === "active"; }).length) || 0;
            setProvider(function (provider) { return (__assign(__assign({}, provider), { userLeases: numberOfDeployments_1, userActiveLeases: numberOfActiveLeases_1 })); });
        }
    }, [leases]);
    var networkCapacity = (0, react_1.useMemo)(function () {
        return {
            activeCPU: provider.stats.cpu.active / 1000,
            pendingCPU: provider.stats.cpu.pending / 1000,
            totalCPU: collectTotals(provider.stats.cpu) / 1000,
            activeGPU: provider.stats.gpu.active,
            pendingGPU: provider.stats.gpu.pending,
            totalGPU: collectTotals(provider.stats.gpu),
            activeMemory: provider.stats.memory.active,
            pendingMemory: provider.stats.memory.pending,
            totalMemory: collectTotals(provider.stats.memory),
            activeStorage: provider.stats.storage.ephemeral.active + provider.stats.storage.persistent.active,
            pendingStorage: provider.stats.storage.ephemeral.pending + provider.stats.storage.persistent.pending,
            totalStorage: collectTotals(provider.stats.storage.ephemeral) + collectTotals(provider.stats.storage.persistent),
            activeEphemeralStorage: provider.stats.storage.ephemeral.active,
            pendingEphemeralStorage: provider.stats.storage.ephemeral.pending,
            availableEphemeralStorage: provider.stats.storage.ephemeral.available,
            activePersistentStorage: provider.stats.storage.persistent.active,
            pendingPersistentStorage: provider.stats.storage.persistent.pending,
            availablePersistentStorage: provider.stats.storage.persistent.available
        };
    }, [provider]);
    var refresh = function () {
        getProviderDetail();
        getLeases();
        getProviderStatus();
    };
    function groupUptimeChecksByPeriod(uptimeChecks) {
        if (uptimeChecks === void 0) { uptimeChecks = []; }
        var groupedSnapshots = [];
        var sortedUptimeChecks = __spreadArray([], uptimeChecks, true).sort(function (a, b) { return new Date(a.checkDate).getTime() - new Date(b.checkDate).getTime(); });
        var _loop_1 = function (snapshot) {
            var recentGroup = groupedSnapshots.find(function (x) { return (0, date_fns_1.differenceInMinutes)(new Date(snapshot.checkDate), x.checkDate) < (smallScreen ? 30 : 15); });
            if (recentGroup) {
                recentGroup.checks.push(snapshot.isOnline);
            }
            else {
                groupedSnapshots.push({
                    checkDate: new Date(snapshot.checkDate),
                    checks: [snapshot.isOnline]
                });
            }
        };
        for (var _i = 0, sortedUptimeChecks_1 = sortedUptimeChecks; _i < sortedUptimeChecks_1.length; _i++) {
            var snapshot = sortedUptimeChecks_1[_i];
            _loop_1(snapshot);
        }
        return groupedSnapshots.map(function (x) { return ({
            date: x.checkDate,
            status: x.checks.every(function (x) { return x; }) ? "online" : x.checks.every(function (x) { return !x; }) ? "offline" : "partial"
        }); });
    }
    var uptimePeriods = (0, react_1.useMemo)(function () { return groupUptimeChecksByPeriod((provider === null || provider === void 0 ? void 0 : provider.uptime) || []); }, [provider === null || provider === void 0 ? void 0 : provider.uptime, smallScreen]);
    var wasRecentlyOnline = provider && (provider.isOnline || (provider.lastOnlineDate && new Date(provider.lastOnlineDate) >= (0, date_fns_1.sub)(new Date(), { hours: 24 })));
    return (<Layout_1.default isLoading={isLoading}>
      <CustomNextSeo_1.CustomNextSeo title={"Provider detail ".concat((provider === null || provider === void 0 ? void 0 : provider.name) || (provider === null || provider === void 0 ? void 0 : provider.owner))} url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.providerDetail(owner))}/>

      <ProviderDetailLayout_1.default address={owner} page={ProviderDetailLayout_1.ProviderDetailTabs.DETAIL} refresh={refresh} provider={provider}>
        {!provider && isLoading && (<div className="flex items-center justify-center">
            <components_1.Spinner size="large"/>
          </div>)}

        {provider && !wasRecentlyOnline && !isLoadingProvider && (<components_1.Alert variant="warning" className="flex items-center justify-center p-8 text-lg">
            This provider is inactive.
          </components_1.Alert>)}

        {networkCapacity && wasRecentlyOnline && (<>
            <div className="mb-4">
              <NetworkCapacity {...networkCapacity}/>
            </div>

            <div className="grid grid-cols-1 gap-4 space-y-4 lg:grid-cols-2">
              <div className="basis-1/2">
                <ActiveLeasesGraph_1.ActiveLeasesGraph provider={provider}/>
              </div>

              <div className="order-first basis-1/2 lg:order-last">
                <Title_1.Title subTitle className="mb-2 font-normal tracking-tight">
                  Up time <span className="ml-1 text-sm">(24h)</span>
                </Title_1.Title>
                <div className="flex items-center space-x-[1px] lg:space-x-[2px]">
                  {uptimePeriods.map(function (x) { return (<components_1.CustomNoDivTooltip key={x.date.toISOString()} title={<react_intl_1.FormattedDate value={x.date} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit"/>}>
                      <div className={(0, utils_1.cn)("h-[24px] w-[2%] max-w-[8px] rounded-[2px]", {
                    "bg-green-600": x.status === "online",
                    "bg-destructive": x.status === "offline",
                    "bg-warning": x.status === "partial"
                })}/>
                    </components_1.CustomNoDivTooltip>); })}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>24h ago</span>
                  <span>Now</span>
                </div>
              </div>
            </div>
          </>)}

        {provider && providerAttributesSchema && (<>
            <div className="mt-4">
              <Title_1.Title subTitle className="mb-4 font-normal tracking-tight">
                General Info
              </Title_1.Title>

              <components_1.Card className="mb-4">
                <components_1.CardContent className="mb-4 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <LabelValue_1.LabelValue label="Host" value={provider.host}/>
                    <LabelValue_1.LabelValue label="Website" value={provider.website}/>
                    <LabelValue_1.LabelValue label="Status page" value={provider.statusPage}/>
                    <LabelValue_1.LabelValue label="Country" value={provider.country}/>
                    <LabelValue_1.LabelValue label="Timezone" value={provider.timezone}/>
                    <LabelValue_1.LabelValue label="Hosting Provider" value={provider.hostingProvider}/>
                  </div>
                  <div>
                    <LabelValue_1.LabelValue label="Email" value={provider.email}/>
                    <LabelValue_1.LabelValue label="Organization" value={provider.organization}/>
                    <LabelValue_1.LabelValue label="Region" value={provider.locationRegion}/>
                    <LabelValue_1.LabelValue label="City" value={provider.city}/>
                    <LabelValue_1.LabelValue label="Location Type" value={provider.locationType}/>
                    <LabelValue_1.LabelValue label="Tier" value={provider.tier}/>
                  </div>
                </components_1.CardContent>
              </components_1.Card>

              <Title_1.Title subTitle className="mb-4 font-normal tracking-tight">
                Specs
              </Title_1.Title>
              <ProviderSpecs_1.ProviderSpecs provider={provider}/>

              <Title_1.Title subTitle className="mb-4 mt-4 font-normal tracking-tight">
                Features
              </Title_1.Title>
              <components_1.Card className="mb-4">
                <components_1.CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <div>
                    <LabelValue_1.LabelValue label="Akash version" value={provider.akashVersion || "Unknown"}/>
                    <LabelValue_1.LabelValue label="IP Leases" value={provider.featEndpointIp && <iconoir_react_1.Check className="ml-0 text-primary sm:ml-2"/>}/>
                    <LabelValue_1.LabelValue label="Chia" value={provider.workloadSupportChia && <iconoir_react_1.Check className="ml-0 text-primary sm:ml-2"/>}/>
                  </div>
                  <div>
                    <LabelValue_1.LabelValue label="Kube version" value={provider.kube ? "".concat((_b = provider.kube) === null || _b === void 0 ? void 0 : _b.major, ".").concat((_c = provider.kube) === null || _c === void 0 ? void 0 : _c.minor) : "Unkown"}/>
                    <LabelValue_1.LabelValue label="Custom domain" value={provider.featEndpointCustomDomain && <iconoir_react_1.Check className="ml-0 text-primary sm:ml-2"/>}/>
                    <LabelValue_1.LabelValue label="Chia capabilities" value={provider.workloadSupportChiaCapabilities}/>
                  </div>
                </components_1.CardContent>
              </components_1.Card>

              <Title_1.Title subTitle className="mb-4 font-normal tracking-tight">
                Stats
              </Title_1.Title>

              <components_1.Card className="mb-4">
                <components_1.CardContent className="p-4">
                  <LabelValue_1.LabelValue label="Deployments" value={provider.deploymentCount}/>
                  <LabelValue_1.LabelValue label="Leases" value={provider.leaseCount}/>
                  <LabelValue_1.LabelValue label="Orders" value={provider.orderCount || "0"}/>
                  {provider.error && <LabelValue_1.LabelValue label="Errors" value={provider.error}/>}
                </components_1.CardContent>
              </components_1.Card>
            </div>

            <Title_1.Title subTitle className="mb-4 font-normal tracking-tight">
              Raw attributes
            </Title_1.Title>
            <components_1.Card>
              <components_1.CardContent className="p-4">
                {provider.attributes.map(function (x) { return (<LabelValue_1.LabelValue key={x.key} label={x.key} value={x.value}/>); })}
              </components_1.CardContent>
            </components_1.Card>
          </>)}
      </ProviderDetailLayout_1.default>
    </Layout_1.default>);
};
exports.ProviderDetail = ProviderDetail;
function collectTotals(item) {
    return item.active + item.available + item.pending;
}
