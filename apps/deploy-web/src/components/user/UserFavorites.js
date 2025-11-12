"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserFavorites = void 0;
var components_1 = require("@akashnetwork/ui/components");
var next_seo_1 = require("next-seo");
var TemplateGridButton_1 = require("@src/components/shared/TemplateGridButton");
var UserProfileLayout_1 = require("@src/components/user/UserProfileLayout");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var Layout_1 = require("../layout/Layout");
var UserFavorites = function () {
    var _a = (0, useTemplateQuery_1.useUserFavoriteTemplates)(), favoriteTemplates = _a.data, isLoadingTemplates = _a.isLoading;
    var _b = (0, useCustomUser_1.useCustomUser)(), user = _b.user, isLoading = _b.isLoading;
    return (<Layout_1.default isLoading={isLoading}>
      <next_seo_1.NextSeo title={user === null || user === void 0 ? void 0 : user.username}/>
      <UserProfileLayout_1.UserProfileLayout page="favorites" username={user === null || user === void 0 ? void 0 : user.username} bio={user === null || user === void 0 ? void 0 : user.bio}>
        {isLoadingTemplates && (<div className="flex items-center justify-center p-8">
            <components_1.Spinner size="large"/>
          </div>)}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {!isLoadingTemplates && (favoriteTemplates === null || favoriteTemplates === void 0 ? void 0 : favoriteTemplates.length) === 0 && (<div className="p-4">
              <p>No template favorites.</p>
            </div>)}

          {favoriteTemplates === null || favoriteTemplates === void 0 ? void 0 : favoriteTemplates.map(function (t) { return (<TemplateGridButton_1.TemplateGridButton key={t.id} template={t} onClick={function () {
                analytics_service_1.analyticsService.track("user_profile_click_template", {
                    category: "profile",
                    label: "Click on template from templates"
                });
            }}/>); })}
        </div>
      </UserProfileLayout_1.UserProfileLayout>
    </Layout_1.default>);
};
exports.UserFavorites = UserFavorites;
