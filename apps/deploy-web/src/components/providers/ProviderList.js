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
exports.ProviderList = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var dynamic_1 = require("next/dynamic");
var navigation_1 = require("next/navigation");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useLeaseQuery_1 = require("@src/queries/useLeaseQuery");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var networkStore_1 = require("@src/store/networkStore");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var CustomNextSeo_1 = require("../shared/CustomNextSeo");
var Title_1 = require("../shared/Title");
var ProviderMap_1 = require("./ProviderMap");
var ProviderTable_1 = require("./ProviderTable");
var NetworkCapacity = (0, dynamic_1.default)(function () { return Promise.resolve().then(function () { return require("./NetworkCapacity"); }); }, {
    ssr: false
});
var sortOptions = [
    { id: "active-leases-desc", title: "Active Leases (desc)" },
    { id: "active-leases-asc", title: "Active Leases (asc)" },
    { id: "my-leases-desc", title: "Your Leases (desc)" },
    { id: "my-active-leases-desc", title: "Your Active Leases (desc)" },
    { id: "gpu-available-desc", title: "GPUs Available (desc)" }
];
var ProviderList = function () {
    var address = (0, WalletProvider_1.useWallet)().address;
    var _a = (0, react_1.useState)(0), pageIndex = _a[0], setPageIndex = _a[1];
    var _b = (0, react_1.useState)(true), isFilteringActive = _b[0], setIsFilteringActive = _b[1];
    var _c = (0, react_1.useState)(false), isFilteringFavorites = _c[0], setIsFilteringFavorites = _c[1];
    var _d = (0, react_1.useState)(true), isFilteringAudited = _d[0], setIsFilteringAudited = _d[1];
    var _e = (0, react_1.useState)([]), filteredProviders = _e[0], setFilteredProviders = _e[1];
    var _f = (0, react_1.useState)(10), pageSize = _f[0], setPageSize = _f[1];
    var _g = (0, react_1.useState)("active-leases-desc"), sort = _g[0], setSort = _g[1];
    var _h = (0, react_1.useState)(""), search = _h[0], setSearch = _h[1];
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    var favoriteProviders = (0, LocalNoteProvider_1.useLocalNotes)().favoriteProviders;
    var apiEndpoint = settings.apiEndpoint;
    var _j = (0, useProvidersQuery_1.useProviderList)(), providers = _j.data, isLoadingProviders = _j.isFetching, getProviders = _j.refetch;
    var _k = (0, useLeaseQuery_1.useAllLeases)(address, { enabled: false }), leases = _k.data, isLoadingLeases = _k.isFetching, getLeases = _k.refetch;
    var _l = (0, useProvidersQuery_1.useNetworkCapacity)(), networkCapacity = _l.data, isLoadingNetworkCapacity = _l.isFetching;
    var start = pageIndex * pageSize;
    var end = start + pageSize;
    var currentPageProviders = filteredProviders.slice(start, end);
    var pageCount = Math.ceil(filteredProviders.length / pageSize);
    var selectedNetwork = networkStore_1.default.useSelectedNetwork();
    var router = (0, navigation_1.useRouter)();
    var searchParams = (0, navigation_1.useSearchParams)();
    var sortQuery = searchParams === null || searchParams === void 0 ? void 0 : searchParams.get("sort");
    (0, react_1.useEffect)(function () {
        getLeases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiEndpoint]);
    (0, react_1.useEffect)(function () {
        if (sortQuery && sortOptions.some(function (x) { return x.id === sortQuery; })) {
            setSort(sortQuery);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortQuery]);
    (0, react_1.useEffect)(function () {
        if (providers) {
            var filteredProviders_1 = __spreadArray([], providers, true).map(function (p) {
                var numberOfDeployments = (leases === null || leases === void 0 ? void 0 : leases.filter(function (d) { return d.provider === p.owner; }).length) || 0;
                var numberOfActiveLeases = (leases === null || leases === void 0 ? void 0 : leases.filter(function (d) { return d.provider === p.owner && d.state === "active"; }).length) || 0;
                return __assign(__assign({}, p), { userLeases: numberOfDeployments, userActiveLeases: numberOfActiveLeases });
            });
            // Filter for search
            if (search) {
                filteredProviders_1 = filteredProviders_1.filter(function (x) { var _a, _b; return ((_a = x.hostUri) === null || _a === void 0 ? void 0 : _a.includes(search.toLowerCase())) || ((_b = x.owner) === null || _b === void 0 ? void 0 : _b.includes(search.toLowerCase())); });
            }
            if (isFilteringActive) {
                filteredProviders_1 = filteredProviders_1.filter(function (x) { return x.isOnline; });
            }
            if (isFilteringFavorites) {
                filteredProviders_1 = filteredProviders_1.filter(function (x) { return favoriteProviders.some(function (y) { return y === x.owner; }); });
            }
            if (isFilteringAudited) {
                filteredProviders_1 = filteredProviders_1.filter(function (x) { return x.isAudited; });
            }
            filteredProviders_1 = filteredProviders_1.sort(function (a, b) {
                if (sort === "active-leases-desc") {
                    return b.leaseCount - a.leaseCount;
                }
                else if (sort === "active-leases-asc") {
                    return a.leaseCount - b.leaseCount;
                }
                else if (sort === "my-leases-desc") {
                    return b.userLeases - a.userLeases;
                }
                else if (sort === "my-active-leases-desc") {
                    return b.userActiveLeases - a.userActiveLeases;
                }
                else if (sort === "gpu-available-desc") {
                    var totalGpuB = b.availableStats.gpu + b.pendingStats.gpu + b.activeStats.gpu;
                    var totalGpuA = a.availableStats.gpu + a.pendingStats.gpu + a.activeStats.gpu;
                    return totalGpuB - totalGpuA;
                }
                else {
                    return 1;
                }
            });
            setFilteredProviders(filteredProviders_1);
        }
    }, [providers, isFilteringActive, isFilteringFavorites, isFilteringAudited, favoriteProviders, search, sort, leases]);
    var refresh = function () {
        getProviders();
    };
    var handleChangePage = function (newPage) {
        setPageIndex(newPage);
    };
    var onIsFilteringActiveClick = function (value) {
        setPageIndex(0);
        setIsFilteringActive(value);
    };
    var onIsFilteringFavoritesClick = function (value) {
        setPageIndex(0);
        setIsFilteringFavorites(value);
    };
    var onIsFilteringAuditedClick = function (value) {
        setPageIndex(0);
        setIsFilteringAudited(value);
    };
    var onSearchChange = function (event) {
        var value = event.target.value;
        setSearch(value);
        setPageIndex(0);
    };
    var handleSortChange = function (value) {
        router.replace(urlUtils_1.UrlService.providers(value), { scroll: false });
    };
    var onPageSizeChange = function (value) {
        setPageSize(value);
        setPageIndex(0);
    };
    return (<Layout_1.default isLoading={isLoadingProviders || isLoadingLeases || isLoadingNetworkCapacity}>
      <CustomNextSeo_1.CustomNextSeo title="Providers" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.providers())} description="Explore all the providers available on the Akash Network."/>

      <Title_1.Title>Network Capacity</Title_1.Title>

      {providers && providers.length > 0 && (<h3 className="mb-8 text-base text-muted-foreground">
          <span className="text-2xl font-bold text-primary">{providers.filter(function (x) { return x.isOnline; }).length}</span> active providers on {selectedNetwork.title}
        </h3>)}

      {!providers && isLoadingProviders && (<div className="flex items-center justify-center py-16">
          <components_1.Spinner size="large"/>
        </div>)}

      {providers && (<div className="mx-auto max-w-[800px]">
          <ProviderMap_1.ProviderMap providers={providers}/>
        </div>)}

      {providers && networkCapacity && (<div className="mb-8">
          <NetworkCapacity {...networkCapacity}/>
        </div>)}

      {((providers === null || providers === void 0 ? void 0 : providers.length) || 0) > 0 && (<>
          <div className="mr-4">
            <components_1.Button onClick={function () { return window.open("https://akash.network/providers/", "_blank"); }} size="lg" color="secondary">
              Become a provider
              <iconoir_react_1.OpenNewWindow className="ml-2 text-sm"/>
            </components_1.Button>
          </div>

          <div>
            <div className="flex flex-wrap items-center pt-4">
              <div className="flex items-center">
                <h3 className="text-2xl font-bold">Providers</h3>

                <div className="ml-4">
                  <components_1.Button aria-label="back" onClick={function () { return refresh(); }} size="icon" variant="ghost" className="rounded-full">
                    <iconoir_react_1.Refresh />
                  </components_1.Button>
                </div>
              </div>

              <div className="my-2 flex items-center md:my-0 md:ml-8">
                <div>
                  <components_1.CheckboxWithLabel checked={isFilteringActive} onCheckedChange={onIsFilteringActiveClick} label="Active"/>
                </div>
                <div className="ml-4">
                  <components_1.CheckboxWithLabel checked={isFilteringAudited} onCheckedChange={onIsFilteringAuditedClick} label="Audited"/>
                </div>
                <div className="ml-4">
                  <components_1.CheckboxWithLabel checked={isFilteringFavorites} onCheckedChange={onIsFilteringFavoritesClick} label="Favorites"/>
                </div>
              </div>
            </div>

            <div className="my-2 flex flex-col items-center space-y-2 md:flex-row md:space-x-2 md:space-y-0">
              <div className="flex-grow">
                <components_1.Input value={search} onChange={onSearchChange} className="w-full" label="Search Providers" type="text" endIcon={!!search && (<components_1.Button size="icon" variant="text" onClick={function () { return setSearch(""); }}>
                        <iconoir_react_1.Xmark />
                      </components_1.Button>)}/>
              </div>

              <div className="w-full min-w-[200px] md:w-auto">
                <components_1.Label>Sort by</components_1.Label>
                <components_1.Select value={sort} onValueChange={handleSortChange}>
                  <components_1.SelectTrigger>
                    <components_1.SelectValue placeholder="Select lease"/>
                  </components_1.SelectTrigger>
                  <components_1.SelectContent>
                    <components_1.SelectGroup>
                      {sortOptions.map(function (l) { return (<components_1.SelectItem key={l.id} value={l.id}>
                          <span className="text-sm text-muted-foreground">{l.title}</span>
                        </components_1.SelectItem>); })}
                    </components_1.SelectGroup>
                  </components_1.SelectContent>
                </components_1.Select>
              </div>
            </div>

            <ProviderTable_1.ProviderTable providers={currentPageProviders} sortOption={sort}/>

            {currentPageProviders.length === 0 && (<div className="p-4 text-center">
                <p>No provider found.</p>
              </div>)}

            {((providers === null || providers === void 0 ? void 0 : providers.length) || 0) > 0 && (<div className="flex items-center justify-center py-8">
                <components_1.CustomPagination pageSize={pageSize} setPageIndex={handleChangePage} pageIndex={pageIndex} totalPageCount={pageCount} setPageSize={onPageSizeChange}/>
              </div>)}
          </div>
        </>)}
    </Layout_1.default>);
};
exports.ProviderList = ProviderList;
