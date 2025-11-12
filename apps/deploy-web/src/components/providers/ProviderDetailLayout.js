"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderDetailTabs = void 0;
var react_1 = require("react");
var react_error_boundary_1 = require("react-error-boundary");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var WalletProvider_1 = require("@src/context/WalletProvider");
var usePreviousRoute_1 = require("@src/hooks/usePreviousRoute");
var urlUtils_1 = require("@src/utils/urlUtils");
var Title_1 = require("../shared/Title");
var ProviderSummary_1 = require("./ProviderSummary");
var ProviderDetailTabs;
(function (ProviderDetailTabs) {
    ProviderDetailTabs["DETAIL"] = "1";
    ProviderDetailTabs["LEASES"] = "2";
    ProviderDetailTabs["RAW"] = "3";
})(ProviderDetailTabs || (exports.ProviderDetailTabs = ProviderDetailTabs = {}));
var ProviderDetailLayout = function (_a) {
    var children = _a.children, page = _a.page, address = _a.address, provider = _a.provider, refresh = _a.refresh;
    var router = (0, navigation_1.useRouter)();
    var walletAddress = (0, WalletProvider_1.useWallet)().address;
    var previousRoute = (0, usePreviousRoute_1.usePreviousRoute)();
    var handleTabChange = function (newValue) {
        switch (newValue) {
            case ProviderDetailTabs.LEASES:
                router.push(urlUtils_1.UrlService.providerDetailLeases(address));
                break;
            case ProviderDetailTabs.RAW:
                router.push(urlUtils_1.UrlService.providerDetailRaw(address));
                break;
            case ProviderDetailTabs.DETAIL:
            default:
                router.push(urlUtils_1.UrlService.providerDetail(address));
                break;
        }
    };
    function handleBackClick() {
        if (previousRoute) {
            router.back();
        }
        else {
            router.push(urlUtils_1.UrlService.providers());
        }
    }
    return (<div className="pb-12">
      <div className="mb-2 flex items-center">
        <components_1.Button aria-label="back" onClick={handleBackClick} size="sm" variant="ghost" className="rounded-full">
          <iconoir_react_1.NavArrowLeft />
        </components_1.Button>
        <Title_1.Title className="ml-2 text-2xl">Provider detail</Title_1.Title>

        <div className="ml-4">
          <components_1.Button aria-label="back" onClick={function () { return refresh(); }} size="sm" className="rounded-full" variant="ghost">
            <iconoir_react_1.Refresh />
          </components_1.Button>
        </div>

        {provider && walletAddress === address && (<div className="ml-4">
            <link_1.default href={urlUtils_1.UrlService.providerDetailEdit(provider.owner)} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default", size: "sm" }))}>
              Edit
            </link_1.default>
          </div>)}
      </div>

      {provider && (<>
          <ProviderSummary_1.ProviderSummary provider={provider}/>

          <components_1.Tabs value={page} onValueChange={handleTabChange}>
            <components_1.TabsList className="mb-4 grid w-full grid-cols-3 rounded-t-none">
              <components_1.TabsTrigger value={ProviderDetailTabs.DETAIL}>Detail</components_1.TabsTrigger>
              <components_1.TabsTrigger value={ProviderDetailTabs.LEASES}>My Leases</components_1.TabsTrigger>
              <components_1.TabsTrigger value={ProviderDetailTabs.RAW}>Raw Data</components_1.TabsTrigger>
            </components_1.TabsList>

            <react_error_boundary_1.ErrorBoundary FallbackComponent={components_1.ErrorFallback}>
              <div className="pt-8">{children}</div>
            </react_error_boundary_1.ErrorBoundary>
          </components_1.Tabs>
        </>)}
    </div>);
};
exports.default = ProviderDetailLayout;
