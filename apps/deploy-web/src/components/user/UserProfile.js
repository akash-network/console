"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfile = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var link_1 = require("next/link");
var TemplateGridButton_1 = require("@src/components/shared/TemplateGridButton");
var UserProfileLayout_1 = require("@src/components/user/UserProfileLayout");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var UserProfile = function (_a) {
    var username = _a.username, user = _a.user;
    var _b = (0, useTemplateQuery_1.useUserTemplates)(username), userTemplates = _b.data, isLoadingTemplates = _b.isLoading;
    var _c = (0, useCustomUser_1.useCustomUser)(), _user = _c.user, isLoading = _c.isLoading;
    return (<Layout_1.default isLoading={isLoading || isLoadingTemplates}>
      <UserProfileLayout_1.UserProfileLayout page="templates" username={username} bio={user === null || user === void 0 ? void 0 : user.bio}>
        {isLoadingTemplates && (<div className="flex items-center justify-center p-8">
            <components_1.Spinner size="large"/>
          </div>)}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {!isLoadingTemplates && (userTemplates === null || userTemplates === void 0 ? void 0 : userTemplates.length) === 0 && (<div className="p-4">
              <p className="text-sm text-muted-foreground">No public templates.</p>

              {username === (_user === null || _user === void 0 ? void 0 : _user.username) && (<link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default", size: "sm" }), "mt-4")} href={urlUtils_1.UrlService.sdlBuilder()} onClick={function () {
                    analytics_service_1.analyticsService.track("create_sdl_template_link", {
                        category: "profile",
                        label: "Create SDL template link from profile"
                    });
                }}>
                  Create one!
                </link_1.default>)}
            </div>)}

          {userTemplates === null || userTemplates === void 0 ? void 0 : userTemplates.map(function (t) { return (<TemplateGridButton_1.TemplateGridButton key={t.id} template={t} onClick={function () {
                analytics_service_1.analyticsService.track("user_profile_click_template", {
                    category: "profile",
                    label: "Click on template from templates"
                });
            }}/>); })}
        </div>
      </UserProfileLayout_1.UserProfileLayout>
    </Layout_1.default>);
};
exports.UserProfile = UserProfile;
