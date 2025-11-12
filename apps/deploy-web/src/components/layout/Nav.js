"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nav = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var ui_config_1 = require("@src/config/ui.config");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useTheme_1 = require("@src/hooks/useTheme");
var walletStore_1 = require("@src/store/walletStore");
var urlUtils_1 = require("@src/utils/urlUtils");
var AccountMenu_1 = require("./AccountMenu");
var AkashLogo_1 = require("./AkashLogo");
var WalletStatus_1 = require("./WalletStatus");
var Nav = function (_a) {
    var isMobileOpen = _a.isMobileOpen, handleDrawerToggle = _a.handleDrawerToggle, className = _a.className;
    var theme = (0, useTheme_1.default)();
    var isSignedInWithTrial = (0, jotai_1.useAtom)(walletStore_1.default.isSignedInWithTrial)[0];
    var user = (0, useCustomUser_1.useCustomUser)().user;
    return (<header className={(0, utils_1.cn)("fixed top-0 z-50 w-full border-b border-border bg-popover dark:bg-background", className)}>
      <div className="flex h-14 items-center justify-between pl-4 pr-4">
        {!!theme && (<link_1.default className="flex items-center" href="/">
            <AkashLogo_1.AkashLogo />
          </link_1.default>)}

        <div>
          <components_1.Button size="icon" className="rounded-full md:hidden" variant="ghost" onClick={handleDrawerToggle}>
            {isMobileOpen ? <iconoir_react_1.Xmark /> : <iconoir_react_1.Menu />}
          </components_1.Button>
        </div>

        <div style={{ height: "".concat(ui_config_1.ACCOUNT_BAR_HEIGHT, "px") }} className={"hidden items-center md:flex"}>
          <div>
            <link_1.default passHref href={urlUtils_1.UrlService.getStarted()}>
              <components_1.Button variant="text" className="relative text-xs text-foreground">
                Get Started
              </components_1.Button>
            </link_1.default>
          </div>

          <div className="flex items-center">
            <div className="ml-4 flex items-center gap-2">
              <WalletStatus_1.WalletStatus />

              {isSignedInWithTrial && !user && (<link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "outline" }))} href={urlUtils_1.UrlService.login()}>
                  Sign in
                </link_1.default>)}
            </div>

            <AccountMenu_1.AccountMenu />
          </div>
        </div>
      </div>
    </header>);
};
exports.Nav = Nav;
