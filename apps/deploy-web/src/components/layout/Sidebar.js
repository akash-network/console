"use strict";
"use client";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sidebar = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var Drawer_1 = require("@mui/material/Drawer");
var styles_1 = require("@mui/material/styles");
var useMediaQuery_1 = require("@mui/material/useMediaQuery");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var image_1 = require("next/image");
var link_1 = require("next/link");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useFlag_1 = require("@src/hooks/useFlag");
var useUser_1 = require("@src/hooks/useUser");
var sdlStore_1 = require("@src/store/sdlStore");
var urlUtils_1 = require("@src/utils/urlUtils");
var MobileSidebarUser_1 = require("./MobileSidebarUser");
var ModeToggle_1 = require("./ModeToggle");
var NodeStatusBar_1 = require("./NodeStatusBar");
var SidebarGroupMenu_1 = require("./SidebarGroupMenu");
var DRAWER_WIDTH = 240;
var CLOSED_DRAWER_WIDTH = 57;
var Sidebar = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h;
    var isMobileOpen = _a.isMobileOpen, handleDrawerToggle = _a.handleDrawerToggle, isNavOpen = _a.isNavOpen, onOpenMenuClick = _a.onOpenMenuClick, mdDrawerClassName = _a.mdDrawerClassName;
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    var _j = (0, jotai_1.useAtom)(sdlStore_1.default.deploySdl), setDeploySdl = _j[1];
    var muiTheme = (0, styles_1.useTheme)();
    var smallScreen = (0, useMediaQuery_1.default)(muiTheme.breakpoints.down("md"));
    var wallet = (0, WalletProvider_1.useWallet)();
    var user = (0, useUser_1.useUser)().user;
    var isAlertsEnabled = (0, useFlag_1.useFlag)("alerts");
    var mainRoutes = (0, react_1.useMemo)(function () {
        var routes = [
            {
                title: "Home",
                icon: function (props) { return <iconoir_react_1.Home {...props}/>; },
                url: urlUtils_1.UrlService.home(),
                activeRoutes: [urlUtils_1.UrlService.home()]
            },
            {
                title: "Deployments",
                icon: function (props) { return <iconoir_react_1.Cloud {...props}/>; },
                url: urlUtils_1.UrlService.deploymentList(),
                activeRoutes: [urlUtils_1.UrlService.deploymentList(), "/deployments", "/new-deployment"]
            },
            {
                title: "Templates",
                icon: function (props) { return <iconoir_react_1.MultiplePages {...props}/>; },
                url: urlUtils_1.UrlService.templates(),
                activeRoutes: [urlUtils_1.UrlService.templates()]
            },
            {
                title: "SDL Builder",
                icon: function (props) { return <iconoir_react_1.Tools {...props}/>; },
                url: urlUtils_1.UrlService.sdlBuilder(),
                activeRoutes: [urlUtils_1.UrlService.sdlBuilder()],
                testId: "sidebar-sdl-builder-link"
            },
            {
                title: "Providers",
                icon: function (props) { return <iconoir_react_1.Server {...props}/>; },
                url: urlUtils_1.UrlService.providers(),
                activeRoutes: [urlUtils_1.UrlService.providers()]
            }
        ];
        if (isAlertsEnabled && (user === null || user === void 0 ? void 0 : user.userId) && wallet.isManaged) {
            routes.push({
                title: "Alerts",
                icon: function (props) { return <iconoir_react_1.MessageAlert {...props}/>; },
                url: urlUtils_1.UrlService.alerts(),
                activeRoutes: [urlUtils_1.UrlService.alerts()]
            });
        }
        return routes;
    }, [isAlertsEnabled, user === null || user === void 0 ? void 0 : user.userId, wallet.isManaged]);
    var routeGroups = (0, react_1.useMemo)(function () { return [
        {
            hasDivider: false,
            routes: mainRoutes
        }
    ]; }, [mainRoutes]);
    var extraRoutes = (0, react_1.useMemo)(function () {
        var routes = [
            {
                hasDivider: false,
                routes: __spreadArray(__spreadArray([
                    {
                        title: "Follow Akash",
                        icon: function (props) { return <iconoir_react_1.Heart {...props}/>; },
                        hoveredRoutes: [
                            {
                                hasDivider: false,
                                routes: [
                                    {
                                        title: "Akash Github",
                                        icon: function (props) { return <iconoir_react_1.Github {...props}/>; },
                                        url: "https://github.com/akash-network/console",
                                        target: "_blank",
                                        rel: "noreferrer noopener"
                                    },
                                    {
                                        title: "Akash on X",
                                        icon: function (props) { return <iconoir_react_1.X {...props}/>; },
                                        url: "https://twitter.com/akashnet",
                                        target: "_blank",
                                        rel: "noreferrer noopener"
                                    },
                                    {
                                        title: "Akash Youtube",
                                        icon: function (props) { return <iconoir_react_1.Youtube {...props}/>; },
                                        url: "https://youtube.com/@AkashNetwork?si=cd2P3ZlAa4gNQw0X&sub_confirmation=1",
                                        target: "_blank",
                                        rel: "noreferrer noopener"
                                    },
                                    {
                                        title: "Akash Discord",
                                        icon: function (props) { return <iconoir_react_1.Discord {...props}/>; },
                                        url: "https://discord.akash.network",
                                        target: "_blank",
                                        rel: "noreferrer noopener"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        title: "Resources",
                        icon: function (props) { return <iconoir_react_1.InfoCircle {...props}/>; },
                        hoveredRoutes: [
                            {
                                hasDivider: false,
                                routes: [
                                    {
                                        title: "Akash Network",
                                        icon: function (props) { return <image_1.default src="/images/akash-logo.svg" alt="Akash Logo" quality={100} width={20} height={20} {...props}/>; },
                                        url: "https://akash.network",
                                        activeRoutes: [],
                                        target: "_blank"
                                    },
                                    {
                                        title: "Stats",
                                        icon: function (props) { return <iconoir_react_1.StatsUpSquare {...props}/>; },
                                        url: "https://stats.akash.network",
                                        activeRoutes: [],
                                        target: "_blank",
                                        hasDivider: true
                                    },
                                    {
                                        title: "Price Compare",
                                        icon: function (props) { return <iconoir_react_1.MoneySquare {...props}/>; },
                                        url: "https://akash.network/about/pricing/custom/",
                                        activeRoutes: [],
                                        target: "_blank"
                                    },
                                    {
                                        title: "Akash Console API",
                                        icon: function (props) { return <iconoir_react_1.EvPlug {...props}/>; },
                                        url: "https://console-api.akash.network/v1/swagger",
                                        activeRoutes: [],
                                        target: "_blank"
                                    },
                                    {
                                        title: "Docs",
                                        icon: function (props) { return <iconoir_react_1.Book {...props}/>; },
                                        url: "https://akash.network/docs",
                                        activeRoutes: [],
                                        target: "_blank"
                                    },
                                    {
                                        title: "FAQ",
                                        icon: function (props) { return <iconoir_react_1.Page {...props}/>; },
                                        url: urlUtils_1.UrlService.faq(),
                                        activeRoutes: [urlUtils_1.UrlService.faq()]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        title: "Help from Expert",
                        icon: function (props) { return <iconoir_react_1.HeadsetHelp {...props}/>; },
                        url: "https://share.hsforms.com/29tSLilX9Qye5Rxrlsz7WPwsaima",
                        activeRoutes: [],
                        target: "_blank",
                        isNew: true
                    }
                ], (wallet.isWalletConnected && !wallet.isManaged
                    ? [
                        {
                            title: "App Settings",
                            icon: function (props) { return <iconoir_react_1.Settings {...props}/>; },
                            url: urlUtils_1.UrlService.settings(),
                            activeRoutes: [urlUtils_1.UrlService.settings()]
                        }
                    ]
                    : []), true), [
                    {
                        title: "More Info",
                        icon: function (props) { return <iconoir_react_1.MoreHorizCircle {...props}/>; },
                        hoveredRoutes: [
                            {
                                hasDivider: false,
                                routes: __spreadArray(__spreadArray([], (wallet.isWalletConnected && !wallet.isManaged
                                    ? [
                                        {
                                            customComponent: <NodeStatusBar_1.NodeStatusBar />
                                        }
                                    ]
                                    : []), true), [
                                    {
                                        title: "Privacy Policy",
                                        url: urlUtils_1.UrlService.privacyPolicy()
                                    },
                                    {
                                        title: "Terms of Service",
                                        url: urlUtils_1.UrlService.termsOfService()
                                    },
                                    {
                                        title: "Contact",
                                        url: urlUtils_1.UrlService.contact()
                                    },
                                    {
                                        customComponent: (<div className="text-muted-foreground">
                        <components_1.Separator className="my-1"/>
                        <div className="px-4 py-2 text-sm">Version {process.env.NEXT_PUBLIC_APP_VERSION}</div>

                        <div className="px-4 py-2">
                          <ModeToggle_1.ModeToggle />
                        </div>
                      </div>)
                                    }
                                ], false)
                            }
                        ]
                    }
                ], false)
            }
        ];
        return routes;
    }, [wallet]);
    var onToggleMenuClick = function () {
        onOpenMenuClick();
    };
    var onDeployClick = function () {
        setDeploySdl(null);
    };
    var drawer = (<div style={{ width: isNavOpen ? DRAWER_WIDTH : CLOSED_DRAWER_WIDTH }} className="box-border flex h-full flex-shrink-0 flex-col items-center justify-between overflow-y-auto overflow-x-hidden border-r-[1px] border-muted-foreground/20 bg-popover transition-[width] duration-300 ease-in-out md:h-[calc(100%-57px)] dark:bg-background">
      <div className={(0, utils_1.cn)("flex w-full flex-col items-center justify-between", (_b = {}, _b["p-2"] = isNavOpen, _b["pb-2 pt-2"] = !isNavOpen, _b))}>
        <link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default", size: isNavOpen ? "lg" : "icon" }), "h-[45px] w-full leading-4", (_c = {},
            _c["h-[45px] w-[45px] min-w-0 pb-2 pt-2"] = !isNavOpen,
            _c))} href={urlUtils_1.UrlService.newDeployment()} onClick={onDeployClick} data-testid="sidebar-deploy-button" aria-disabled={settings.isBlockchainDown}>
          {isNavOpen && "Deploy "}
          <iconoir_react_1.Rocket className={(0, utils_1.cn)("rotate-45", (_d = {}, _d["ml-4"] = isNavOpen, _d))} fontSize="small"/>
        </link_1.default>

        {routeGroups.map(function (g, i) { return (<SidebarGroupMenu_1.SidebarGroupMenu key={i} group={g} hasDivider={g.hasDivider} isNavOpen={isNavOpen}/>); })}
      </div>

      <div className={(0, utils_1.cn)("flex w-full flex-col items-center justify-between", (_e = {}, _e["p-2"] = isNavOpen, _e["pb-2 pt-2"] = !isNavOpen, _e))}>
        {extraRoutes.map(function (g, i) { return (<SidebarGroupMenu_1.SidebarGroupMenu key={i} group={g} hasDivider={g.hasDivider} isNavOpen={isNavOpen}/>); })}

        {smallScreen && <MobileSidebarUser_1.MobileSidebarUser />}

        {!smallScreen && (<div className="flex w-full items-center justify-center pt-2">
            <components_1.Button size="sm" variant="ghost" onClick={onToggleMenuClick} className={(0, utils_1.cn)("flex w-full items-center justify-start gap-3 px-4", (_f = {}, _f["w-[45px] min-w-0 justify-center p-2"] = !isNavOpen, _f))}>
              {isNavOpen ? <iconoir_react_1.SidebarCollapse /> : <iconoir_react_1.SidebarExpand />}
              {isNavOpen && <span>Collapse</span>}
            </components_1.Button>
          </div>)}
      </div>
    </div>);
    return (<nav className={(0, utils_1.cn)("ease fixed z-[100] bg-header/95 md:flex-shrink-0", (_g = {},
            _g["md:w-[240px]"] = isNavOpen,
            _g["md:w-[57px]"] = !isNavOpen,
            _g))}>
      {/* Mobile Drawer */}
      <Drawer_1.default variant="temporary" open={isMobileOpen} disableScrollLock onClose={handleDrawerToggle} className="block p-4 md:hidden" ModalProps={{
            keepMounted: true // Better open performance on mobile.
        }} sx={{
            display: { xs: "block", sm: "block", md: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: DRAWER_WIDTH, overflow: "hidden" },
            zIndex: 990
        }} PaperProps={{
            sx: {
                border: "none"
            }
        }}>
        {drawer}
      </Drawer_1.default>

      {/* Desktop Drawer */}
      <Drawer_1.default className="hidden md:block" variant="permanent" PaperProps={{
            className: (0, utils_1.cn)("border-none ease z-[1000] bg-header/95 transition-[width] duration-300 box-border overflow-hidden mt-[57px]", (_h = {},
                _h["md:w-[240px]"] = isNavOpen,
                _h["md:w-[57px]"] = !isNavOpen,
                _h), mdDrawerClassName)
        }} open>
        {drawer}
      </Drawer_1.default>
    </nav>);
};
exports.Sidebar = Sidebar;
