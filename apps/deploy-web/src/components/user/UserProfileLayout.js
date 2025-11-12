"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileLayout = void 0;
var react_1 = require("react");
var react_error_boundary_1 = require("react-error-boundary");
var components_1 = require("@akashnetwork/ui/components");
var router_1 = require("next/router");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var urlUtils_1 = require("@src/utils/urlUtils");
var UserProfileLayout = function (_a) {
    var page = _a.page, children = _a.children, _b = _a.username, username = _b === void 0 ? "" : _b, bio = _a.bio;
    var router = (0, router_1.useRouter)();
    var user = (0, useCustomUser_1.useCustomUser)().user;
    var handleTabChange = function (newValue) {
        analytics_service_1.analyticsService.track("user_profile_template_tab", {
            category: "profile",
            label: "Click on ".concat(newValue, " tab")
        });
        switch (newValue) {
            case "templates":
                router.push(urlUtils_1.UrlService.userProfile(username));
                break;
            case "favorites":
                router.push(urlUtils_1.UrlService.userFavorites());
                break;
            case "settings":
                router.push(urlUtils_1.UrlService.userSettings());
                break;
        }
    };
    return (<>
      <div className="py-4">
        <h1 className="mb-2 text-3xl">{username}</h1>

        {bio && <h3 className="text-lg">{bio}</h3>}
      </div>

      <components_1.Tabs value={page} onValueChange={handleTabChange}>
        <components_1.TabsList className="mb-4 grid w-full grid-cols-3 border-b">
          <components_1.TabsTrigger value="templates">Templates</components_1.TabsTrigger>
          {(user === null || user === void 0 ? void 0 : user.username) === username && (<>
              <components_1.TabsTrigger value="favorites">Favorites</components_1.TabsTrigger>
              <components_1.TabsTrigger value="settings">Settings</components_1.TabsTrigger>
            </>)}
        </components_1.TabsList>

        <react_error_boundary_1.ErrorBoundary FallbackComponent={components_1.ErrorFallback}>{children}</react_error_boundary_1.ErrorBoundary>
      </components_1.Tabs>
    </>);
};
exports.UserProfileLayout = UserProfileLayout;
