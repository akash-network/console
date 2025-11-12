"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelValueOld = void 0;
var utils_1 = require("@akashnetwork/ui/utils");
var LabelValueOld = function (_a) {
    var label = _a.label, value = _a.value, _b = _a.className, className = _b === void 0 ? "" : _b;
    return (<div className={(0, utils_1.cn)("flex items-center", className)}>
      <label className="font-bold dark:text-neutral-500">{label}</label>
      {value && <div className="ml-2 flex items-center text-sm">{value}</div>}
    </div>);
};
exports.LabelValueOld = LabelValueOld;
