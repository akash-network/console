"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarRouteButton = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var urlUtils_1 = require("@src/utils/urlUtils");
var SidebarRouteButton = function (_a) {
    var _b, _c, _d, _e, _f;
    var _g, _h, _j;
    var route = _a.route, _k = _a.className, className = _k === void 0 ? "" : _k, _l = _a.isNavOpen, isNavOpen = _l === void 0 ? true : _l, _m = _a.useNextLinkTag, useNextLinkTag = _m === void 0 ? true : _m, _o = _a.isHovered, isHovered = _o === void 0 ? false : _o;
    var pathname = (0, navigation_1.usePathname)();
    var isSelected = route.url === urlUtils_1.UrlService.home() ? pathname === "/" : (_g = route.activeRoutes) === null || _g === void 0 ? void 0 : _g.some(function (x) { return pathname === null || pathname === void 0 ? void 0 : pathname.startsWith(x); });
    var linkProps = {
        target: (_h = route.target) !== null && _h !== void 0 ? _h : "_self",
        rel: route.rel ? route.rel : "",
        href: (_j = route.url) !== null && _j !== void 0 ? _j : "",
        className: (0, utils_1.cn)((0, components_1.buttonVariants)({ variant: isSelected ? "secondary" : "ghost", size: "sm" }), "flex w-full items-center justify-start text-current hover:no-underline", (_b = {},
            _b["font-bold"] = isSelected,
            _b["min-w-[initial] px-4 py-1"] = isNavOpen,
            _b["w-[45px] min-w-0 p-2"] = !isNavOpen,
            _b)),
        "data-testid": route.testId
    };
    var innerContent = (<>
      {!!route.icon && (<span className={(0, utils_1.cn)("z-[100] min-w-0", (_c = {}, _c["m-[initial]"] = isNavOpen, _c["mx-auto"] = !isNavOpen, _c))}>
          {route.icon({ className: (0, utils_1.cn)((_d = {}, _d["text-primary font-bold"] = isSelected, _d["mx-auto"] = !isNavOpen, _d), "text-xs") })}
        </span>)}
      {isNavOpen && <span className={(0, utils_1.cn)("mb-1 mt-1 min-w-0 flex-auto whitespace-nowrap", (_e = {}, _e["ml-4"] = !!route.icon, _e))}>{route.title}</span>}
      {route.isNew && (<components_1.Badge className={(0, utils_1.cn)("absolute right-3 top-1/2 h-4 -translate-y-1/2 pl-1 pr-1 text-[.5rem] leading-3", (_f = {}, _f["hidden"] = !isNavOpen, _f))}>New</components_1.Badge>)}
    </>);
    var content = route.url && useNextLinkTag ? <link_1.default {...linkProps}>{innerContent}</link_1.default> : <a {...linkProps}>{innerContent}</a>;
    return (<li className={className}>
      {route.hasDivider && <components_1.Separator className="my-1"/>}
      {!isNavOpen && !isHovered ? (<components_1.Tooltip>
          <components_1.TooltipTrigger asChild>{content}</components_1.TooltipTrigger>
          <components_1.TooltipContent side="right">
            <p>{route.title}</p>
          </components_1.TooltipContent>
        </components_1.Tooltip>) : (content)}
    </li>);
};
exports.SidebarRouteButton = SidebarRouteButton;
