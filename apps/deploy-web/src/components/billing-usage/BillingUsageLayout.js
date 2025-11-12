"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingUsageLayout = exports.BillingUsageTabs = void 0;
var react_1 = require("react");
var react_error_boundary_1 = require("react-error-boundary");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var navigation_1 = require("next/navigation");
var Title_1 = require("@src/components/shared/Title");
var urlUtils_1 = require("@src/utils/urlUtils");
var BillingUsageTabs;
(function (BillingUsageTabs) {
    BillingUsageTabs["BILLING"] = "BILLING";
    BillingUsageTabs["USAGE"] = "USAGE";
})(BillingUsageTabs || (exports.BillingUsageTabs = BillingUsageTabs = {}));
var BillingUsageLayout = function (_a) {
    var _b, _c;
    var children = _a.children, page = _a.page;
    var router = (0, navigation_1.useRouter)();
    var changeTab = function (newValue) {
        switch (newValue) {
            case BillingUsageTabs.BILLING:
                router.push(urlUtils_1.UrlService.billing());
                break;
            case BillingUsageTabs.USAGE:
            default:
                router.push(urlUtils_1.UrlService.usage());
                break;
        }
    };
    return (<components_1.Tabs value={page} onValueChange={changeTab} className="space-y-4 pb-6">
      <Title_1.Title>Billing & Usage</Title_1.Title>

      <components_1.TabsList className="grid w-full grid-cols-2">
        <components_1.TabsTrigger value={BillingUsageTabs.BILLING} className={(0, utils_1.cn)((_b = {}, _b["font-bold"] = page === BillingUsageTabs.BILLING, _b))}>
          Billing
        </components_1.TabsTrigger>
        <components_1.TabsTrigger value={BillingUsageTabs.USAGE} className={(0, utils_1.cn)((_c = {}, _c["font-bold"] = page === BillingUsageTabs.USAGE, _c))}>
          Usage
        </components_1.TabsTrigger>
      </components_1.TabsList>

      <react_error_boundary_1.ErrorBoundary FallbackComponent={components_1.ErrorFallback}>{children}</react_error_boundary_1.ErrorBoundary>
    </components_1.Tabs>);
};
exports.BillingUsageLayout = BillingUsageLayout;
