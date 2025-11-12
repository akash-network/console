"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpandMore = void 0;
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var ExpandMore = function (_a) {
    var _b;
    var expand = _a.expand, className = _a.className;
    return <iconoir_react_1.ArrowDown className={(0, utils_1.cn)(className, "transition-all", (_b = {}, _b["rotate-180"] = expand, _b))}/>;
};
exports.ExpandMore = ExpandMore;
