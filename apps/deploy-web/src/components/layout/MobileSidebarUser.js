"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileSidebarUser = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var urlUtils_1 = require("@src/utils/urlUtils");
var SignUpButton_1 = require("../auth/SignUpButton/SignUpButton");
var SidebarRouteButton_1 = require("./SidebarRouteButton");
var WalletStatus_1 = require("./WalletStatus");
var MobileSidebarUser = function () {
    var _a = (0, useCustomUser_1.useCustomUser)(), user = _a.user, isLoading = _a.isLoading;
    return (<ul className="w-full overflow-hidden border-0 p-0">
      <div className="flex w-full items-center justify-center p-2">
        <WalletStatus_1.WalletStatus />
      </div>

      <components_1.Separator />

      {isLoading ? (<div className="text-center">
          <components_1.Spinner size="small"/>
        </div>) : user ? (<div className="p-2">
          {user.username && (<SidebarRouteButton_1.SidebarRouteButton route={{
                    title: user.username,
                    icon: function (props) { return (<components_1.Avatar {...props} className="h-6 w-6">
                    {user.username && user.username[0].toUpperCase()}
                  </components_1.Avatar>); },
                    url: urlUtils_1.UrlService.userProfile(user.username),
                    activeRoutes: [urlUtils_1.UrlService.userProfile(user.username)]
                }}/>)}
          {user.username && (<SidebarRouteButton_1.SidebarRouteButton route={{
                    title: "Templates",
                    icon: function (props) { return <iconoir_react_1.MediaImageList {...props}/>; },
                    url: urlUtils_1.UrlService.userProfile(user.username),
                    activeRoutes: [urlUtils_1.UrlService.userProfile(user.username)]
                }}/>)}
          <SidebarRouteButton_1.SidebarRouteButton route={{
                title: "Settings",
                icon: function (props) { return <iconoir_react_1.Settings {...props}/>; },
                url: urlUtils_1.UrlService.userSettings(),
                activeRoutes: [urlUtils_1.UrlService.userSettings()]
            }}/>
          <SidebarRouteButton_1.SidebarRouteButton useNextLinkTag={false} route={{
                title: "Logout",
                icon: function (props) { return <iconoir_react_1.LogOut {...props}/>; },
                url: urlUtils_1.UrlService.logout(),
                activeRoutes: []
            }}/>
        </div>) : (<div className="p-2">
          <li>
            <SignUpButton_1.SignUpButton className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default", size: "sm" }), "w-full")}/>
          </li>
          <li>
            <link_1.default href={urlUtils_1.UrlService.login()} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "ghost", size: "sm" }), "w-full")}>
              Sign in
            </link_1.default>
          </li>
        </div>)}

      <components_1.Separator className="mb-4"/>
    </ul>);
};
exports.MobileSidebarUser = MobileSidebarUser;
