"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarHoveredGroupMenu = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var SidebarRouteButton_1 = require("./SidebarRouteButton");
var SidebarHoveredGroupMenu = function (_a) {
    var _b;
    var group = _a.group, _c = _a.hasDivider, hasDivider = _c === void 0 ? true : _c, isNavOpen = _a.isNavOpen;
    return (<div className="p-1">
      {hasDivider && <components_1.Separator className="mb-2"/>}

      <nav className={(0, utils_1.cn)("flex flex-1 flex-col", (_b = {}, _b["items-center"] = !isNavOpen, _b))} aria-label="Sidebar">
        <ul role="list" className="w-full space-y-1">
          {!!group.title && isNavOpen && (<li>
              <span className="text-sm font-light">{group.title}</span>
            </li>)}

          {group.routes.map(function (route, i) {
            return route.customComponent ? (<li key={"".concat(i, "-").concat(route.title)}>{route.customComponent}</li>) : (<SidebarRouteButton_1.SidebarRouteButton key={"".concat(i, "-").concat(route.title)} route={route} isHovered/>);
        })}
        </ul>
      </nav>
    </div>);
};
exports.SidebarHoveredGroupMenu = SidebarHoveredGroupMenu;
