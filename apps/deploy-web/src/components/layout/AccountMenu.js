"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountMenu = AccountMenu;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var ClickAwayListener_1 = require("@mui/material/ClickAwayListener");
var iconoir_react_1 = require("iconoir-react");
var navigation_1 = require("next/navigation");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useFlag_1 = require("@src/hooks/useFlag");
var urlUtils_1 = require("@src/utils/urlUtils");
var CustomDropdownLinkItem_1 = require("../shared/CustomDropdownLinkItem");
function AccountMenu() {
    var _a = (0, react_1.useState)(false), open = _a[0], setOpen = _a[1];
    var _b = (0, useCustomUser_1.useCustomUser)(), user = _b.user, isLoading = _b.isLoading;
    var username = user === null || user === void 0 ? void 0 : user.username;
    var router = (0, navigation_1.useRouter)();
    var isBillingUsageEnabled = (0, useFlag_1.useFlag)("billing_usage");
    var wallet = (0, WalletProvider_1.useWallet)();
    var authService = (0, ServicesProvider_1.useServices)().authService;
    return (<react_1.default.Fragment>
      <div className="flex items-center text-center">
        {isLoading ? (<div className="pl-2 pr-2">
            <components_1.Spinner size="small"/>
          </div>) : (<div className="pl-2 pr-2">
            <components_1.DropdownMenu modal={false} open={open}>
              <components_1.DropdownMenuTrigger asChild>
                <components_1.Button size="icon" variant="ghost" onClick={function () { return (username ? router.push(urlUtils_1.UrlService.userProfile(username)) : null); }} onMouseOver={function () { return setOpen(true); }}>
                  <components_1.Avatar className="h-[2rem] w-[2rem]">
                    <components_1.AvatarFallback>{username ? username[0].toUpperCase() : <iconoir_react_1.User />}</components_1.AvatarFallback>
                  </components_1.Avatar>
                </components_1.Button>
              </components_1.DropdownMenuTrigger>
              <components_1.DropdownMenuContent align="end" onMouseLeave={function () {
                setOpen(false);
            }} className="w-[160px]">
                <ClickAwayListener_1.default onClickAway={function () {
                setOpen(false);
            }}>
                  <div className="flex w-full items-center justify-center">
                    {!isLoading && user ? (<div className="w-full">
                        {username && (<CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return router.push(urlUtils_1.UrlService.userProfile(username)); }} icon={<components_1.Avatar className="h-4 w-4">
                                <components_1.AvatarFallback className="text-xs">{username ? username[0].toUpperCase() : <iconoir_react_1.User />}</components_1.AvatarFallback>
                              </components_1.Avatar>}>
                            {username}
                          </CustomDropdownLinkItem_1.CustomDropdownLinkItem>)}
                        <components_1.DropdownMenuSeparator />
                        <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return router.push(urlUtils_1.UrlService.userSettings()); }} icon={<iconoir_react_1.Settings />}>
                          Profile Settings
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                        <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return router.push(urlUtils_1.UrlService.userApiKeys()); }} icon={<iconoir_react_1.Key />}>
                          API Keys
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                        {username && (<CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return router.push(urlUtils_1.UrlService.userProfile(username)); }} icon={<iconoir_react_1.MultiplePages />}>
                            Templates
                          </CustomDropdownLinkItem_1.CustomDropdownLinkItem>)}
                        <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return router.push(urlUtils_1.UrlService.userFavorites()); }} icon={<iconoir_react_1.Star />}>
                          Favorites
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                        {isBillingUsageEnabled && (user === null || user === void 0 ? void 0 : user.userId) && wallet.isManaged && (<CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return router.push(urlUtils_1.UrlService.billing()); }} icon={<iconoir_react_1.GraphUp />}>
                            Billing & Usage
                          </CustomDropdownLinkItem_1.CustomDropdownLinkItem>)}
                        <components_1.DropdownMenuSeparator />
                        <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return authService.logout(); }} icon={<iconoir_react_1.LogOut />}>
                          Logout
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                      </div>) : (<div className="w-full space-y-1">
                        <CustomDropdownLinkItem_1.CustomDropdownLinkItem className="justify-center bg-primary p-2 !text-white hover:bg-primary/80 hover:text-white focus:bg-primary/80" onClick={function () { return authService.signup(); }}>
                          Sign up
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                        <CustomDropdownLinkItem_1.CustomDropdownLinkItem onClick={function () { return router.push(urlUtils_1.UrlService.login()); }} className="justify-center p-2">
                          Sign in
                        </CustomDropdownLinkItem_1.CustomDropdownLinkItem>
                      </div>)}
                  </div>
                </ClickAwayListener_1.default>
              </components_1.DropdownMenuContent>
            </components_1.DropdownMenu>
          </div>)}
      </div>
    </react_1.default.Fragment>);
}
