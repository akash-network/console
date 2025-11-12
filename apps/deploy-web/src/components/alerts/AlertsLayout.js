"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertsLayout = exports.AlertTabs = void 0;
var react_1 = require("react");
var react_error_boundary_1 = require("react-error-boundary");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var urlUtils_1 = require("@src/utils/urlUtils");
var Title_1 = require("../shared/Title");
var AlertTabs;
(function (AlertTabs) {
    AlertTabs["ALERTS"] = "ALERTS";
    AlertTabs["NOTIFICATION_CHANNELS"] = "NOTIFICATION_CHANNELS";
})(AlertTabs || (exports.AlertTabs = AlertTabs = {}));
var AlertsLayout = function (_a) {
    var _b, _c;
    var children = _a.children, page = _a.page, title = _a.title, headerActions = _a.headerActions, returnable = _a.returnable;
    var router = (0, navigation_1.useRouter)();
    var handleTabChange = function (newValue) {
        switch (newValue) {
            case AlertTabs.ALERTS:
                router.push(urlUtils_1.UrlService.alerts());
                break;
            case AlertTabs.NOTIFICATION_CHANNELS:
            default:
                router.push(urlUtils_1.UrlService.notificationChannels());
                break;
        }
    };
    return (<components_1.Tabs value={page} onValueChange={handleTabChange} className="pb-6">
      <components_1.TabsList className="grid w-full grid-cols-2">
        <components_1.TabsTrigger value={AlertTabs.ALERTS} className={(0, utils_1.cn)((_b = {}, _b["font-bold"] = page === AlertTabs.ALERTS, _b))}>
          Alerts
        </components_1.TabsTrigger>
        <components_1.TabsTrigger value={AlertTabs.NOTIFICATION_CHANNELS} className={(0, utils_1.cn)((_c = {}, _c["font-bold"] = page === AlertTabs.NOTIFICATION_CHANNELS, _c))}>
          Notification Channels
        </components_1.TabsTrigger>
      </components_1.TabsList>

      <div className="mt-4 flex flex-wrap items-center py-4">
        {returnable && (<link_1.default href="." type="button" className="p-2">
            <iconoir_react_1.NavArrowLeft />
          </link_1.default>)}
        <Title_1.Title>{title}</Title_1.Title>
        {headerActions}
      </div>

      <react_error_boundary_1.ErrorBoundary FallbackComponent={components_1.ErrorFallback}>{children}</react_error_boundary_1.ErrorBoundary>
    </components_1.Tabs>);
};
exports.AlertsLayout = AlertsLayout;
