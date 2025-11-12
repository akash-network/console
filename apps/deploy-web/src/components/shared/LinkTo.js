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
exports.LinkTo = LinkTo;
var react_1 = require("react");
var utils_1 = require("@akashnetwork/ui/utils");
function LinkTo(_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b, rest = __rest(_a, ["children", "className"]);
    return (<button type="button" {...rest} className={(0, utils_1.cn)("m-0 inline-flex cursor-pointer border-0 bg-transparent p-0 text-primary underline visited:text-primary-visited disabled:cursor-default disabled:text-gray-500", className)}>
      {children}
    </button>);
}
