"use strict";
"use client";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomDropdownLinkItem = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
exports.CustomDropdownLinkItem = react_1.default.forwardRef(function (_a, ref) {
    var onClick = _a.onClick, icon = _a.icon, children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b, rest = __rest(_a, ["onClick", "icon", "children", "className"]);
    return (<components_1.DropdownMenuIconItem className={(0, utils_1.cn)("cursor-pointer hover:text-primary", className)} onClick={onClick} icon={icon} ref={ref} {...rest}>
      {children}
    </components_1.DropdownMenuIconItem>);
});
