"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusPill = void 0;
var utils_1 = require("@akashnetwork/ui/utils");
var StatusPill = function (_a) {
    var _b;
    var state = _a.state, style = _a.style, _c = _a.size, size = _c === void 0 ? "medium" : _c, _d = _a.className, className = _d === void 0 ? "" : _d;
    return (<div style={style} className={(0, utils_1.cn)("rounded-2xl", (_b = {},
            _b["ml-2 h-2 w-2"] = size === "small",
            _b["ml-4 h-4 w-4"] = size === "medium",
            _b["bg-green-600"] = state === "active",
            _b["bg-destructive"] = state === "closed",
            _b), className)}/>);
};
exports.StatusPill = StatusPill;
