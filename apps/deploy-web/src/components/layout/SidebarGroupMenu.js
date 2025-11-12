"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarGroupMenu = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var SidebarGroupMenuPopover_1 = require("./SidebarGroupMenuPopover");
var SidebarRouteButton_1 = require("./SidebarRouteButton");
var SidebarGroupMenu = function (_a) {
    var _b;
    var group = _a.group, _c = _a.hasDivider, hasDivider = _c === void 0 ? true : _c, isNavOpen = _a.isNavOpen;
    return (<div className="mt-4 w-full">
      {hasDivider && <components_1.Separator className="mb-2"/>}

      <nav className={(0, utils_1.cn)("flex flex-1 flex-col", (_b = {}, _b["items-center"] = !isNavOpen, _b))} aria-label="Sidebar">
        <ul role="list" className="space-y-1">
          {!!group.title && isNavOpen && (<li>
              <span className="text-sm font-light">{group.title}</span>
            </li>)}

          {group.routes.map(function (route) {
            return !route.hoveredRoutes ? (<SidebarRouteButton_1.SidebarRouteButton key={route.title} route={route} isNavOpen={isNavOpen}/>) : (<SidebarGroupMenuPopover_1.SidebarGroupMenuPopover key={route.title} route={route} isNavOpen={isNavOpen}/>);
        })}
        </ul>
      </nav>
    </div>);
};
exports.SidebarGroupMenu = SidebarGroupMenu;
