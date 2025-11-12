"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarGroupMenuPopover = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var ClickAwayListener_1 = require("@mui/material/ClickAwayListener");
var SidebarHoveredGroupMenu_1 = require("./SidebarHoveredGroupMenu");
var SidebarGroupMenuPopover = function (_a) {
    var _b, _c, _d;
    var _e;
    var route = _a.route, isNavOpen = _a.isNavOpen;
    var _f = (0, react_1.useState)(false), open = _f[0], setOpen = _f[1];
    return (<components_1.Popover open={open} onOpenChange={setOpen}>
      <components_1.PopoverTrigger asChild>
        <components_1.Button variant="ghost" size="sm" data-testid={route.testId} className={(0, utils_1.cn)("flex w-full items-center justify-start text-current hover:no-underline", (_b = {},
            _b["min-w-[initial] px-4 py-1"] = isNavOpen,
            _b["w-[45px] min-w-0 p-2"] = !isNavOpen,
            _b))} onMouseOver={function () { return setOpen(true); }}>
          {!!route.icon && (<span className={(0, utils_1.cn)("z-[100] min-w-0", (_c = {}, _c["m-[initial]"] = isNavOpen, _c["mx-auto"] = !isNavOpen, _c))}>
              {route.icon({ className: (0, utils_1.cn)((_d = {}, _d["mx-auto"] = !isNavOpen, _d), "text-xs") })}
            </span>)}
          {isNavOpen && <span className="mb-1 ml-4 mt-1 min-w-0 flex-auto whitespace-nowrap text-left">{route.title}</span>}
        </components_1.Button>
      </components_1.PopoverTrigger>
      <components_1.PopoverContent className="w-64 p-0" align="start" side="right" sideOffset={5} onMouseLeave={function () {
            setOpen(false);
        }}>
        <ClickAwayListener_1.default onClickAway={function () {
            setOpen(false);
        }}>
          <div className="w-full">
            {(_e = route.hoveredRoutes) === null || _e === void 0 ? void 0 : _e.map(function (route, i) { return (<SidebarHoveredGroupMenu_1.SidebarHoveredGroupMenu key={"".concat(i, "-").concat(route.title)} group={route} hasDivider={route.hasDivider} isNavOpen={isNavOpen}/>); })}
          </div>
        </ClickAwayListener_1.default>
      </components_1.PopoverContent>
    </components_1.Popover>);
};
exports.SidebarGroupMenuPopover = SidebarGroupMenuPopover;
