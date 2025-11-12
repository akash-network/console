"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Title = void 0;
var utils_1 = require("@akashnetwork/ui/utils");
var Title = function (_a) {
    var children = _a.children, subTitle = _a.subTitle, id = _a.id, _b = _a.className, className = _b === void 0 ? "" : _b;
    return subTitle ? (<h3 className={(0, utils_1.cn)("text-xl font-semibold sm:text-2xl", className)} id={id}>
      {children}
    </h3>) : (<h1 className={(0, utils_1.cn)("text-2xl font-bold tracking-tight sm:text-4xl", className)} id={id}>
      {children}
    </h1>);
};
exports.Title = Title;
