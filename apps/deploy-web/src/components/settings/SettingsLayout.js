"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsLayout = exports.SettingsTabs = void 0;
var react_1 = require("react");
var react_error_boundary_1 = require("react-error-boundary");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var navigation_1 = require("next/navigation");
var urlUtils_1 = require("@src/utils/urlUtils");
var Title_1 = require("../shared/Title");
var SettingsTabs;
(function (SettingsTabs) {
    SettingsTabs["GENERAL"] = "GENERAL";
    SettingsTabs["AUTHORIZATIONS"] = "AUTHORIZATIONS";
})(SettingsTabs || (exports.SettingsTabs = SettingsTabs = {}));
var SettingsLayout = function (_a) {
    var _b, _c;
    var children = _a.children, page = _a.page, title = _a.title, headerActions = _a.headerActions;
    var router = (0, navigation_1.useRouter)();
    var handleTabChange = function (newValue) {
        switch (newValue) {
            case SettingsTabs.AUTHORIZATIONS:
                router.push(urlUtils_1.UrlService.settingsAuthorizations());
                break;
            case SettingsTabs.GENERAL:
            default:
                router.push(urlUtils_1.UrlService.settings());
                break;
        }
    };
    return (<components_1.Tabs value={page} onValueChange={handleTabChange}>
      <components_1.TabsList className="grid w-full grid-cols-6">
        <components_1.TabsTrigger value={SettingsTabs.GENERAL} className={(0, utils_1.cn)((_b = {}, _b["font-bold"] = page === SettingsTabs.GENERAL, _b))}>
          General
        </components_1.TabsTrigger>
        <components_1.TabsTrigger value={SettingsTabs.AUTHORIZATIONS} className={(0, utils_1.cn)((_c = {}, _c["font-bold"] = page === SettingsTabs.AUTHORIZATIONS, _c))}>
          Authorizations
        </components_1.TabsTrigger>
      </components_1.TabsList>

      <div className="mt-4 flex flex-wrap items-center py-4">
        <Title_1.Title>{title}</Title_1.Title>
        {headerActions}
      </div>

      <react_error_boundary_1.ErrorBoundary FallbackComponent={components_1.ErrorFallback}>{children}</react_error_boundary_1.ErrorBoundary>
    </components_1.Tabs>);
};
exports.SettingsLayout = SettingsLayout;
