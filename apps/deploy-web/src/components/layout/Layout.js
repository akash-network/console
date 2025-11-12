"use strict";
"use client";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Loading = void 0;
var react_1 = require("react");
var react_error_boundary_1 = require("react-error-boundary");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var material_1 = require("@mui/material");
var constants_1 = require("date-fns/constants");
var ui_config_1 = require("@src/config/ui.config");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useTopBanner_1 = require("@src/hooks/useTopBanner");
var LinearLoadingSkeleton_1 = require("../shared/LinearLoadingSkeleton");
var Nav_1 = require("./Nav");
var Sidebar_1 = require("./Sidebar");
var TopBanner_1 = require("./TopBanner");
var TrackingScripts_1 = require("./TrackingScripts");
var WelcomeToTrialModal_1 = require("./WelcomeToTrialModal");
var Layout = function (_a) {
    var children = _a.children, isLoading = _a.isLoading, isUsingSettings = _a.isUsingSettings, isUsingWallet = _a.isUsingWallet, disableContainer = _a.disableContainer, containerClassName = _a.containerClassName;
    var _b = (0, react_1.useState)("en-US"), locale = _b[0], setLocale = _b[1];
    (0, react_1.useEffect)(function () {
        if (navigator === null || navigator === void 0 ? void 0 : navigator.language) {
            setLocale(navigator === null || navigator === void 0 ? void 0 : navigator.language);
        }
    }, []);
    return (<react_intl_1.IntlProvider locale={locale} defaultLocale="en-US">
      <LayoutApp isLoading={isLoading} isUsingSettings={isUsingSettings} isUsingWallet={isUsingWallet} disableContainer={disableContainer} containerClassName={containerClassName}>
        {children}
      </LayoutApp>
    </react_intl_1.IntlProvider>);
};
var LayoutApp = function (_a) {
    var _b, _c, _d;
    var children = _a.children, isLoading = _a.isLoading, isUsingSettings = _a.isUsingSettings, isUsingWallet = _a.isUsingWallet, disableContainer = _a.disableContainer, _e = _a.containerClassName, containerClassName = _e === void 0 ? "" : _e;
    var muiTheme = (0, material_1.useTheme)();
    var smallScreen = (0, material_1.useMediaQuery)(muiTheme.breakpoints.down("md"));
    var _f = (0, react_1.useState)(function () {
        var _isNavOpen = localStorage.getItem("isNavOpen");
        if (_isNavOpen !== null && !smallScreen) {
            return _isNavOpen === "true";
        }
        return true;
    }), isNavOpen = _f[0], setIsNavOpen = _f[1];
    var _g = (0, react_1.useState)(false), isMobileOpen = _g[0], setIsMobileOpen = _g[1];
    var _h = (0, SettingsProvider_1.useSettings)(), refreshNodeStatuses = _h.refreshNodeStatuses, isSettingsInit = _h.isSettingsInit;
    var isWalletLoaded = (0, WalletProvider_1.useWallet)().isWalletLoaded;
    var hasBanner = (0, useTopBanner_1.useTopBanner)().hasBanner;
    (0, react_1.useEffect)(function () {
        var refreshNodeIntervalId = setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, refreshNodeStatuses()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); }, constants_1.millisecondsInMinute);
        return function () {
            clearInterval(refreshNodeIntervalId);
        };
    }, [refreshNodeStatuses]);
    var onOpenMenuClick = function () {
        setIsNavOpen(function (prev) {
            var newValue = !prev;
            localStorage.setItem("isNavOpen", newValue ? "true" : "false");
            return newValue;
        });
    };
    var handleDrawerToggle = function () {
        setIsMobileOpen(!isMobileOpen);
    };
    return (<div className="flex h-full">
      <TopBanner_1.TopBanner />

      <div className="w-full flex-1" style={{ marginTop: "".concat(ui_config_1.ACCOUNT_BAR_HEIGHT + (hasBanner ? 40 : 0), "px") }}>
        <div className="h-full">
          <Nav_1.Nav isMobileOpen={isMobileOpen} handleDrawerToggle={handleDrawerToggle} className={{ "top-[40px]": hasBanner }}/>

          <div className="block h-full w-full flex-grow rounded-none md:flex">
            <Sidebar_1.Sidebar onOpenMenuClick={onOpenMenuClick} isNavOpen={isNavOpen} handleDrawerToggle={handleDrawerToggle} isMobileOpen={isMobileOpen} mdDrawerClassName={_b = {}, _b["h-[calc(100%-40px)] mt-[97px]"] = hasBanner, _b}/>

            <div className={(0, utils_1.cn)("ease ml-0 h-full flex-grow transition-[margin-left] duration-300", (_c = {},
            _c["md:ml-[240px]"] = isNavOpen,
            _c["md:ml-[57px]"] = !isNavOpen,
            _c))}>
              {isLoading !== undefined && <LinearLoadingSkeleton_1.LinearLoadingSkeleton isLoading={isLoading}/>}

              <react_error_boundary_1.ErrorBoundary FallbackComponent={components_1.ErrorFallback}>
                {!isUsingSettings || isSettingsInit ? (!isUsingWallet || isWalletLoaded ? (<div className={(0, utils_1.cn)((_d = {}, _d["container pb-8 pt-4"] = !disableContainer, _d), containerClassName)}>{children}</div>) : (<exports.Loading text="Loading wallet..."/>)) : (<exports.Loading text="Loading settings..."/>)}
                <WelcomeToTrialModal_1.WelcomeToTrialModal />
              </react_error_boundary_1.ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      <react_1.Suspense fallback={null}>
        <TrackingScripts_1.TrackingScripts />
      </react_1.Suspense>
    </div>);
};
var Loading = function (_a) {
    var text = _a.text, testId = _a.testId;
    return (<div className="flex h-full w-full flex-col items-center justify-center pb-12 pt-12" data-testid={testId}>
      <div className="pb-4">
        <components_1.Spinner size="large"/>
      </div>
      <div>
        <h5>{text}</h5>
      </div>
    </div>);
};
exports.Loading = Loading;
exports.default = Layout;
