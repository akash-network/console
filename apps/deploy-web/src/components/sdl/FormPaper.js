"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormPaper = FormPaper;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
function FormPaper(_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b, _c = _a.contentClassName, contentClassName = _c === void 0 ? "" : _c;
    return (<components_1.Card className={(0, utils_1.cn)(className, "bg-background/30")}>
      <components_1.CardContent className={(0, utils_1.cn)("px-4 py-4", contentClassName)}>{children}</components_1.CardContent>
    </components_1.Card>);
}
